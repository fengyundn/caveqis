"""Run the calculator in a subprocess owned by the desktop app."""

if __name__ == "__main__":
    from multiprocessing import freeze_support

    freeze_support()

    from hmac import compare_digest
    import os
    import threading
    import time

    from waitress import create_server

    from app import SERVER_OPTIONS, app

    token = os.environ.pop("CAVEQIS_DESKTOP_TOKEN")
    port = int(os.environ.pop("CAVEQIS_DESKTOP_PORT"))
    parent_pid = int(os.environ.pop("CAVEQIS_DESKTOP_PARENT"))

    def desktop_request(environ, start_response):
        provided = environ.get("HTTP_X_CAVEQIS_SESSION", "").encode("latin-1")
        if not compare_digest(provided, token.encode("ascii")):
            start_response("403 Forbidden", [("Content-Length", "0")])
            return [b""]
        return app(environ, start_response)

    server = create_server(desktop_request, host="127.0.0.1", port=port, **SERVER_OPTIONS)

    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
        kernel32.WaitForSingleObject.restype = wintypes.DWORD
        parent = kernel32.OpenProcess(0x00100000, False, parent_pid)
        if not parent:
            raise ctypes.WinError(ctypes.get_last_error())

        def wait_for_window_to_close():
            # A blocking read on inherited stdin can stall Windows workers.
            kernel32.WaitForSingleObject(parent, 0xFFFFFFFF)
            os._exit(0)
    else:
        def wait_for_window_to_close():
            while os.getppid() == parent_pid:
                time.sleep(0.25)
            os._exit(0)

    print("CAVEQIS_READY", flush=True)
    threading.Thread(target=wait_for_window_to_close, daemon=True).start()
    server.run()
