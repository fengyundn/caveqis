package xyz.caveqis.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import android.view.WindowInsets;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int OPEN_DOCUMENT = 1;
    private static final int SAVE_DOCUMENT = 2;
    private static final int MAX_EXPORT = 16 * 1024 * 1024;
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        + "font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; "
        + "base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
    private static final Map<String, String> LOCAL_HEADERS = new HashMap<>();
    static {
        LOCAL_HEADERS.put("Content-Security-Policy", CSP);
        LOCAL_HEADERS.put("X-Content-Type-Options", "nosniff");
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Messenger results = new Messenger(new Handler(Looper.getMainLooper(), this::receive));
    private WebView web;
    private Messenger engine;
    private boolean bound;
    private int pendingId;
    private String pendingRequest;
    private ValueCallback<Uri[]> fileChooser;
    private byte[] pendingExport;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            engine = new Messenger(binder);
            sendPending();
        }

        @Override public void onServiceDisconnected(ComponentName name) {
            engine = null;
            if (pendingId != 0) finishCalculation(CalculationService.failure(CalculationService.UNAVAILABLE));
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                    | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        setContentView(root);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.setWebViewClient(new LocalContent());
        web.setWebChromeClient(new DocumentChooser());
        web.addJavascriptInterface(new NativeBridge(), "CaveqisNative");
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        bound = bindService(new Intent(this, CalculationService.class), connection, BIND_AUTO_CREATE);
        web.loadUrl(START);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private final class LocalContent extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isLocal(request.getUrl()) || !"/index.html".equals(request.getUrl().getPath());
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String path = uri.getPath();
            if (isLocal(uri) && "GET".equals(request.getMethod()) && path != null
                && (path.equals("/index.html") || path.startsWith("/static/"))
                && !path.contains("..") && !path.contains("\\")) {
                try {
                    String mime = mimeFor(path);
                    String charset = mime.startsWith("text/") || mime.equals("application/javascript") ? "UTF-8" : null;
                    return new WebResourceResponse(mime, charset, 200, "OK", LOCAL_HEADERS,
                        getAssets().open(path.substring(1)));
                } catch (IOException ignored) {
                    // Unknown paths never fall back to a network request.
                }
            }
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private final class DocumentChooser extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                     FileChooserParams params) {
            if (fileChooser != null) fileChooser.onReceiveValue(null);
            fileChooser = callback;
            try {
                startActivityForResult(params.createIntent(), OPEN_DOCUMENT);
            } catch (ActivityNotFoundException error) {
                fileChooser = null;
                callback.onReceiveValue(null);
                notifyFile("open-error");
            }
            return true;
        }
    }

    public final class NativeBridge {
        @JavascriptInterface public void calculate(int id, String payload) {
            main.post(() -> {
                if (pendingId != 0) {
                    dispatchResult(id, CalculationService.failure(CalculationService.BUSY));
                    return;
                }
                pendingId = id;
                pendingRequest = payload;
                main.postDelayed(() -> {
                    if (pendingId == id) finishCalculation(CalculationService.failure(CalculationService.UNAVAILABLE));
                }, 18_000);
                sendPending();
            });
        }

        @JavascriptInterface public void copyText(String value) {
            main.post(() -> getSystemService(ClipboardManager.class)
                .setPrimaryClip(ClipData.newPlainText("CAVEQIS", value)));
        }

        @JavascriptInterface public void hideKeyboard() {
            main.post(() -> {
                if (web != null) getSystemService(InputMethodManager.class)
                    .hideSoftInputFromWindow(web.getWindowToken(), 0);
            });
        }

        @JavascriptInterface public void saveFile(String name, String type, String encoded) {
            if (!name.matches("[^/\\\\]{1,180}") || encoded.length() > MAX_EXPORT
                || !(type.equals("image/png") || type.equals("application/json") || type.equals("text/csv"))) {
                main.post(() -> notifyFile("save-error"));
                return;
            }
            try {
                byte[] contents = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
                main.post(() -> chooseExport(name, type, contents));
            } catch (IllegalArgumentException error) {
                main.post(() -> notifyFile("save-error"));
            }
        }
    }

    private void sendPending() {
        if (engine == null || pendingRequest == null) return;
        Message task = Message.obtain(null, CalculationService.CALCULATE);
        task.arg1 = pendingId;
        task.replyTo = results;
        Bundle body = new Bundle();
        body.putString(CalculationService.BODY, pendingRequest);
        task.setData(body);
        pendingRequest = null;
        try {
            engine.send(task);
        } catch (RemoteException error) {
            finishCalculation(CalculationService.failure(CalculationService.UNAVAILABLE));
        }
    }

    private boolean receive(Message reply) {
        if (reply.what != CalculationService.RESULT) return false;
        if (reply.arg1 == pendingId) finishCalculation(reply.getData().getString(CalculationService.BODY));
        return true;
    }

    private void finishCalculation(String result) {
        int id = pendingId;
        pendingId = 0;
        pendingRequest = null;
        dispatchResult(id, result);
    }

    private void dispatchResult(int id, String result) {
        if (web != null) web.evaluateJavascript("window.CaveqisPlatform.receive(" + id + ", "
            + JSONObject.quote(result) + ")", null);
    }

    private void chooseExport(String name, String type, byte[] contents) {
        if (pendingExport != null || web == null) return;
        pendingExport = contents;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(intent, SAVE_DOCUMENT);
        } catch (ActivityNotFoundException error) {
            pendingExport = null;
            notifyFile("save-error");
        }
    }

    private void notifyFile(String message) {
        if (web != null) web.evaluateJavascript("window.CaveqisPlatform.fileStatus("
            + JSONObject.quote(message) + ")", null);
    }

    @Override protected void onActivityResult(int request, int state, Intent data) {
        super.onActivityResult(request, state, data);
        if (request == OPEN_DOCUMENT && fileChooser != null) {
            ValueCallback<Uri[]> callback = fileChooser;
            fileChooser = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(state, data));
        } else if (request == SAVE_DOCUMENT) {
            byte[] export = pendingExport;
            pendingExport = null;
            if (state == RESULT_OK && data != null && data.getData() != null && export != null) {
                Uri uri = data.getData();
                new Thread(() -> {
                    try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
                        if (stream == null) throw new IOException("No output stream");
                        stream.write(export);
                        main.post(() -> notifyFile("saved"));
                    } catch (IOException | SecurityException error) {
                        main.post(() -> notifyFile("save-error"));
                    }
                }, "caveqis-export").start();
            }
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.CaveqisPlatform.handleBack()", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override protected void onDestroy() {
        if (bound) unbindService(connection);
        if (fileChooser != null) fileChooser.onReceiveValue(null);
        main.removeCallbacksAndMessages(null);
        web.destroy();
        web = null;
        super.onDestroy();
    }
}
