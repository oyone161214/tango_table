from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import json
from dotenv import load_dotenv
import traceback # tracebackモジュールをインポート
from openai import OpenAI # 新しいOpenAIクライアントをインポート
from openai import APIStatusError, APIConnectionError, RateLimitError, AuthenticationError # 新しいエラークラスをインポート
import urllib.parse

load_dotenv()

app = Flask(__name__)
os.makedirs('data', exist_ok=True)      # data dir 作成

# OpenAIクライアントを初期化
# APIキーは環境変数から自動的に取得されます
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ファイルリストの表示
@app.route('/')
def index():
    files = [f.replace('.json', '') for f in os.listdir('data') if f.endswith('.json')]
    return render_template('index.html', files=files)

# ファイル新規作成
@app.route('/create', methods=['POST'])
def create_file():
    filename = request.form.get('filename')
    if not filename:
        return redirect('/')
    path = os.path.join('data', f"{filename}.json")
    try:
        if not os.path.exists(path):
            with open(path, 'x', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=4) # f に空のリストを追加・日本語使用可
        return redirect(url_for('vocab_page', filename=filename))
    except FileExistsError:
        return redirect(url_for('vocab_page', filename=filename))
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return redirect('/')

# 選択した単語帳ページにアクセス
@app.route('/vocab/<filename>')
def vocab_page(filename):
    # このページはJavaScriptがデータを取得するためのHTMLを提供します
    return render_template('table.html', filename=filename)


#　JSON形式のファイルをロードする
@app.route('/api/vocab/<filename>', methods=['GET'])
def get_vocab_data(filename):
    file_path = os.path.join('data', f"{filename}.json")
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            words = json.load(f)
        return jsonify(words)
    return jsonify([]), 404 # ファイルが見つからない場合は空のリストと404を返す

#　JSON形式のファイルを保存する(変更点)
@app.route('/api/vocab/<filename>', methods=['POST'])
def add_word_to_vocab(filename):
    file_path = os.path.join('data', f"{filename}.json")
    # エラー処理
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    try:
        # body: JSON.stringify({ word: newWord, meaning: newMeaning })
        new_word_entry = request.get_json()     # 追加するJSON形式のデータを python形式で代入

        # 送信内容に不足があればエラー処理
        if not new_word_entry or 'word' not in new_word_entry or 'meaning' not in new_word_entry:
            return jsonify({"error": "Invalid data. 'word' and 'meaning' are required."}), 400

        with open(file_path, 'r+', encoding='utf-8') as f:
            #全データを取得して、最後尾に新しいデータを挿入
            words = json.load(f)        
            words.append(new_word_entry)
            # ファイルの先頭に戻って、先頭から更新した全データをファイルに上書き
            f.seek(0) 
            json.dump(words, f, ensure_ascii=False, indent=4)       
            f.truncate() # 古い内容を削除

        # 201成功通知
        return jsonify(new_word_entry), 201 
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

# ラジオボタン更新
@app.route('/api/vocab/<filename>', methods=['PUT'])
def update_vocab(filename):

    # body: JSON.stringify({ word, meaning, rating: newRating })
    data = request.get_json()  # 👈 クライアントからのJSONをパース
    word = data.get('word')
    meaning = data.get('meaning')
    rating = data.get('rating')

    filepath = os.path.join('data', f"{filename}.json")
    if not os.path.exists(filepath):
        return jsonify({"error": "ファイルが存在しません"}), 404

    
    # ファイルを読み込んで更新
    with open(filepath, 'r+', encoding='utf-8') as f:
        words = json.load(f)

    # 単語を探して更新
    updated = False
    for item in words:
        if item.get('word') == word and item.get('meaning') == meaning:
            item['rating'] = rating
            updated = True
            break

    if not updated:
        return jsonify({"error": "対象の単語が見つかりません"}), 404

    f.seek(0)
    json.dump(words, f, ensure_ascii=False, indent=4)
    f.truncate()

    #なくてもいい
    return jsonify({"message": "更新成功", "word": word, "rating": rating})


@app.route('/api/vocab/<filename>/<original_word>/<original_meaning>', methods=['PUT'])
def update_word_meaning(filename, original_word, original_meaning):
    data = request.get_json()
    new_word = data.get('word')
    new_meaning = data.get('meaning')
    
    # URLデコード
    original_word = urllib.parse.unquote(original_word)
    original_meaning = urllib.parse.unquote(original_meaning)

    filepath = os.path.join('data', f"{filename}.json")
    if not os.path.exists(filepath):
        return jsonify({"error": "ファイルが存在しません"}), 404

    # ファイルを読み込み、更新し、書き戻す処理をwithブロック内で行う
    with open(filepath, 'r+', encoding='utf-8') as f:
        words = json.load(f)

        updated = False
        for item in words:
            if item.get('word') == original_word and item.get('meaning') == original_meaning:
                if new_word is not None:
                    item['word'] = new_word
                if new_meaning is not None:
                    item['meaning'] = new_meaning
                updated = True
                break

        if not updated:
            return jsonify({"error": "対象の単語が見つかりません"}), 404

        f.seek(0)
        json.dump(words, f, ensure_ascii=False, indent=4)
        f.truncate()

    return jsonify({"message": "単語と意味の更新成功", "original_word": original_word, "new_word": new_word, "new_meaning": new_meaning})


@app.route('/api/vocab/<filename>', methods=['DELETE'])
def delete_vocab(filename):

    # body: JSON.stringify({ word, meaning }) 
    data = request.get_json()
    word = data.get('word')
    meaning = data.get('meaning')

    filepath = os.path.join('data', f"{filename}.json")
    if not os.path.exists(filepath):
        return jsonify({"error": "ファイルが存在しません"}), 404

    # JSON読み込み
    with open(filepath, 'r+', encoding='utf-8') as f:
        words = json.load(f)

        # データの数
        original_len = len(words)
        # データをひとつずつ取り出して、body:の削除する列と一致しないものだけを words に再代入する。
        words = [item for item in words if not (item.get('word') == word and item.get('meaning') == meaning)]

        # 削除前と後を比較
        if len(words) == original_len:
            return jsonify({"error": "単語が見つかりません"}), 404

        # 書き戻し
        f.seek(0)
        json.dump(words, f, ensure_ascii=False, indent=4)
        f.truncate()

        return jsonify({"message": f"'{word}' を削除しました"})


@app.route('/chat', methods=['POST'])
def chat():

    # body: JSON.stringify({ message: promptMessage })
    data = request.get_json()
    message = data.get('message', '')
    decoded_message = urllib.parse.unquote(message) # デコードを試みる
    print(f"Decoded message: {decoded_message}") # デコード後の状態

    try:
        # OpenAI APIキーが設定されているか確認
        # client = OpenAI() の初期化時にAPIキーが渡されるため、ここでは不要
        # if not os.getenv("OPENAI_API_KEY"):
        #     print("Error: OPENAI_API_KEY is not set.")
        #     return jsonify({"error": "OpenAI APIキーが設定されていません。"}), 500

        # 新しい構文でChatCompletionを呼び出す
        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[{'role': 'user', 'content': decoded_message}]
        )

        content = response.choices[0].message.content # .content でテキストを取得
        return jsonify({ 'meaning': content })
    

    except AuthenticationError as e:
        print(f"OpenAI Authentication Error: {e}")
        return jsonify({"error": f"OpenAI認証エラー: APIキーを確認してください。"}), 401
    except RateLimitError as e:
        print(f"OpenAI Rate Limit Error: {e}")
        return jsonify({"error": f"OpenAIレートリミットエラー: しばらく待ってから再試行してください。"}), 429
    except APIStatusError as e: # APIErrorの代わりにAPIStatusErrorを使用
        print(f"OpenAI API Status Error: {e.status_code} - {e.response}")
        return jsonify({"error": f"OpenAI APIエラー: ステータスコード {e.status_code}, 詳細: {e.response}"}), e.status_code
    except APIConnectionError as e:
        print(f"OpenAI API Connection Error: {e}")
        return jsonify({"error": f"OpenAI API接続エラー: ネットワーク接続を確認してください。"}), 500
    except Exception as e: # その他の予期せぬエラーをキャッチ
        print(f"An unexpected error occurred in /chat endpoint: {e}") # 詳細なエラーログ
        traceback.print_exc() # エラートレースバックを出力
        return jsonify({"error": f"サーバー内部エラーが発生しました。詳細: {str(e)}"}), 500
    

if __name__ == "__main__":
    app.run(debug=True)
