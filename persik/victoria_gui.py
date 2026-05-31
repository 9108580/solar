import os
import sys
import tkinter as tk
from tkinter import messagebox

import eel

from persik_app import install_log_redirect, script_dir, start_auto_run_worker, web_dir
import persik_app

index_file_path = os.path.join(web_dir, "index.html")
if not os.path.exists(index_file_path):
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    error_msg = (
        f"ОШИБКА 404: Файл интерфейса не найден!\n\n"
        f"Я ищу файл строго по этому пути:\n{index_file_path}\n\n"
        f"Пожалуйста, проверь:\n"
        f"1. Существует ли папка 'web'.\n"
        f"2. Называется ли файл ровно 'index.html' (без .txt на конце)."
    )
    messagebox.showerror("Ошибка запуска", error_msg)
    sys.exit(1)


if __name__ == "__main__":
    install_log_redirect()
    start_auto_run_worker()
    try:
        persik_app.eel.start("index.html", size=(1100, 800), port=0)
    except Exception:
        persik_app.eel.start("index.html", size=(1100, 800), port=0, mode="edge")
