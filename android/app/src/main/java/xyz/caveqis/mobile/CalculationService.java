package xyz.caveqis.mobile;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.RemoteException;
import android.util.Log;

import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class CalculationService extends Service {
    static final int CALCULATE = 1;
    static final int RESULT = 2;
    static final int CONFIGURE_MCP = 3;
    static final int MCP_RESULT = 4;
    static final String BODY = "body";
    static final String BUSY = "当前有计算正在进行，请稍后重试。";
    static final String UNAVAILABLE = "无法连接计算服务，请确认工具箱服务正在运行。";
    private static final int MAX_REQUEST = 24 * 1024;
    private static final int MAX_RESULT = 256 * 1024;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService mcpWorker = Executors.newSingleThreadExecutor();
    private final Messenger messenger = new Messenger(new Handler(Looper.getMainLooper(), this::handle));
    private Runnable timeout;

    static String failure(String message) {
        return "{\"ok\":false,\"error\":" + JSONObject.quote(message) + "}";
    }

    @Override public IBinder onBind(Intent intent) {
        return messenger.getBinder();
    }

    private boolean handle(Message message) {
        if (message.what == CONFIGURE_MCP && message.replyTo != null) {
            final int id = message.arg1;
            final boolean enabled = message.arg2 == 1;
            final Messenger client = message.replyTo;
            mcpWorker.execute(() -> send(client, MCP_RESULT, id, configureMcp(enabled)));
            return true;
        }
        if (message.what != CALCULATE || message.replyTo == null) return false;

        int id = message.arg1;
        Messenger client = message.replyTo;
        String payload = message.getData().getString(BODY, "");
        if (timeout != null) {
            send(client, id, failure(BUSY));
        } else if (payload.length() > MAX_REQUEST) {
            send(client, id, failure("输入内容超过 24 KB，请拆分计算。"));
        } else {
            Runnable deadline = () -> {
                send(client, id, failure("计算超过 12 秒已停止，请减小问题规模或简化表达式。"));
                Process.killProcess(Process.myPid());
            };
            timeout = deadline;
            main.postDelayed(deadline, 12_000);
            worker.execute(() -> {
                String result = calculate(payload);
                main.post(() -> {
                    if (timeout != deadline) return;
                    main.removeCallbacks(deadline);
                    timeout = null;
                    send(client, id, result);
                });
            });
        }
        return true;
    }

    private String calculate(String payload) {
        try {
            String result = calculatorPython().getModule("mobile_calculation")
                .callAttr("calculate", payload).toString();
            return result.length() <= MAX_RESULT
                ? result : failure("计算超出资源限制，请简化表达式或缩小矩阵。");
        } catch (RuntimeException error) {
            Log.e("CAVEQIS", "The calculation engine failed", error);
            return failure("此问题暂时无法完成计算，请缩小规模或改写表达式。");
        }
    }

    private synchronized Python calculatorPython() {
        if (!Python.isStarted()) Python.start(new AndroidPlatform(this));
        return Python.getInstance();
    }

    private String configureMcp(boolean enabled) {
        if (!enabled && !Python.isStarted()) return "{\"enabled\":false}";
        try {
            return calculatorPython().getModule("mobile_calculation").callAttr("configure_mcp", enabled).toString();
        } catch (RuntimeException error) {
            return "{\"enabled\":false,\"error\":true}";
        }
    }

    private static void send(Messenger client, int id, String result) {
        send(client, RESULT, id, result);
    }

    private static void send(Messenger client, int type, int id, String result) {
        Message reply = Message.obtain(null, type);
        reply.arg1 = id;
        Bundle data = new Bundle();
        data.putString(BODY, result);
        reply.setData(data);
        try {
            client.send(reply);
        } catch (RemoteException ignored) {
            // The activity closed before the calculation finished.
        }
    }

    @Override public void onDestroy() {
        if (timeout != null) Process.killProcess(Process.myPid());
        mcpWorker.execute(() -> configureMcp(false));
        mcpWorker.shutdown();
        worker.shutdownNow();
        super.onDestroy();
    }
}
