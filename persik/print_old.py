import os
import glob
import subprocess
import time

def print_old_invoices():
    print("===========================================")
    print("  🖨️  МАССОВАЯ ЧБ-ПЕЧАТЬ СТАРЫХ СЧЕТОВ  🖨️")
    print("===========================================")

    # Ищем SumatraPDF в папке скрипта
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sumatra_files = glob.glob(os.path.join(base_dir, "SumatraPDF*.exe"))
    
    if not sumatra_files:
        print("[!] Ошибка: Программа SumatraPDF не найдена в папке с проектом!")
        input("Нажмите Enter для выхода...")
        return

    sumatra_path = sumatra_files[0]
    
    # Папки, в которых мы ищем уже скачанные и обработанные счета
    folders_to_scan = ["data/processed", "data/manual_review"]
    files_to_print = []

    # Сканируем папки и все подпапки на наличие PDF-файлов
    for folder in folders_to_scan:
        search_path = os.path.join(base_dir, folder, "**", "*.pdf")
        found = glob.glob(search_path, recursive=True)
        files_to_print.extend(found)

    if not files_to_print:
        print("[!] В папках processed и manual_review не найдено ни одного PDF файла.")
        input("Нажмите Enter для выхода...")
        return

    print(f"\nНайдено файлов для печати: {len(files_to_print)}")
    print("ВНИМАНИЕ: Все файлы будут распечатаны в ЧЕРНО-БЕЛОМ режиме (monochrome)!")
    confirm = input("Хотите отправить их все на принтер по умолчанию? (y/n): ").strip().lower()

    if confirm == 'y':
        print("\n🚀 Начинаю отправку заданий на принтер...")
        for i, file_path in enumerate(files_to_print):
            print(f"  [{i+1}/{len(files_to_print)}] Печать: {os.path.basename(file_path)}")
            try:
                # Скрытая печать на принтер по умолчанию в ЧБ формате
                subprocess.run([
                    sumatra_path, 
                    "-print-to-default", 
                    "-print-settings", "1x,monochrome", 
                    "-silent", 
                    file_path
                ], check=True)
                
                # Даем принтеру 2 секунды, чтобы "переварить" файл и не зависнуть
                time.sleep(2) 
            except Exception as e:
                print(f"  [!] Ошибка при печати {os.path.basename(file_path)}: {e}")
        
        print("\n✅ Все файлы успешно отправлены в очередь печати!")
    else:
        print("\nОтмена печати.")

    input("\nНажмите Enter для выхода...")

if __name__ == "__main__":
    print_old_invoices()