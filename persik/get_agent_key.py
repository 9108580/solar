import requests

PIPEDRIVE_TOKEN = "b7b4773bdea3065c4a93e5ab9bffe638a3f32da2"
url = f"https://api.pipedrive.com/v1/dealFields?api_token={PIPEDRIVE_TOKEN}"

print("🔍 Ищу поля агентов в Pipedrive...")
try:
    res = requests.get(url).json()
    fields = res.get('data', [])
    found = False
    for field in fields:
        name = field.get('name', '')
        # Ищем слово סוכן
        if 'סוכן' in name:
            key = field.get('key', '')
            print(f"✅ Найдено поле: '{name}' -> КЛЮЧ: {key}")
            found = True
            
    if not found:
        print("❌ Поле со словом 'סוכן' не найдено.")
except Exception as e:
    print(f"Ошибка: {e}")