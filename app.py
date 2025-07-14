from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import json

app = Flask(__name__)
os.makedirs('data', exist_ok=True)      # data dir 作成

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
        print('このファイルは既に存在しています')
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

if __name__ == "__main__":
    app.run(debug=True)