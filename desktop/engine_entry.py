"""Run the calculator in a subprocess owned by the desktop app."""

if __name__ == "__main__":
    from multiprocessing import freeze_support

    freeze_support()

    import ctypes
    from ctypes import wintypes
    from hmac import compare_digest
    import os
    import threading

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

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
    kernel32.WaitForSingleObject.restype = wintypes.DWORD
    parent = kernel32.OpenProcess(0x00100000, False, parent_pid)
    if not parent:
        raise ctypes.WinError(ctypes.get_last_error())

    def wait_for_window_to_close():
        # Wait on a process handle instead of stdin. A blocked read on an
        # inherited Windows pipe can hold up Python worker initialization.
        kernel32.WaitForSingleObject(parent, 0xFFFFFFFF)
        os._exit(0)

    print("CAVEQIS_READY", flush=True)
    threading.Thread(target=wait_for_window_to_close, daemon=True).start()
    server.run()
