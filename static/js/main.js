// ファイルがすべて読み込まれたときに実行する
document.addEventListener('DOMContentLoaded', () => {
    const vocabTableBody = document.querySelector('#vocab-table tbody');        //テーブルの行
    const addWordForm = document.getElementById('add-word-form');               //データ追加フォーム
    const loadingMessage = document.getElementById('loading-message');          //NOW LOADING...表示
    const errorMessage = document.getElementById('error-message');              //ERROR表示
    const noWordsMessage = document.getElementById('no-words-message');         //単語がまだない時の表示
    const addWordMessage = document.getElementById('add-word-message');         //単語が追加されたときの表示
    const addWordError = document.getElementById('add-word-error');             //単語が追加されなかったときの表示

    
    const pathSegments = window.location.pathname.split('/');   // URLからファイル名を取得  ["", "table", "test"]
    const filename = pathSegments[pathSegments.length - 1];     // 例: /table/test の 'test'

    if (!vocabTableBody || !filename) {
        // table.html 以外のページでは実行しないか、必要な要素が見つからない場合は処理を中断
        return;
    }

    // 単語データをAPIから取得し、テーブルに表示する関数
    // async ...非同期関数（時間のかかる処理を行う）
    const fetchAndDisplayVocab = async () => {
        // NOW LOADING...
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        vocabTableBody.innerHTML = '';      // 既存の行をクリア

        try {
            const response = await fetch(`/api/vocab/${filename}`);
            if (!response.ok) {     
                // 存在しない単語帳を開いたとき
                if (response.status === 404) {
                    noWordsMessage.textContent = 'この単語帳は存在しません。';
                    noWordsMessage.style.display = 'block';
                    loadingMessage.style.display = 'none';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const words = await response.json();

            if (words.length === 0) {
                noWordsMessage.style.display = 'block';
                document.getElementById('vocab-table').style.display = 'none'; // テーブルを非表示
            } else {
                noWordsMessage.style.display = 'none';
                document.getElementById('vocab-table').style.display = 'table'; // テーブルを表示
                words.forEach(wordEntry => {
                    const row = vocabTableBody.insertRow();
                    const wordCell = row.insertCell();
                    const meaningCell = row.insertCell();
                    wordCell.textContent = wordEntry.word;
                    meaningCell.textContent = wordEntry.meaning;
                });
            }
        } catch (error) {
            console.error('Error fetching vocabulary:', error);
            errorMessage.textContent = `単語帳の読み込み中にエラーが発生しました: ${error.message}`;
            errorMessage.style.display = 'block';
            document.getElementById('vocab-table').style.display = 'none'; // テーブルを非表示
        } finally {
            loadingMessage.style.display = 'none';
        }
    };

    // ページロード時に単語データを取得して表示
    fetchAndDisplayVocab();

    // 単語追加フォームの送信イベントリスナー
    if (addWordForm) {
        addWordForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // デフォルトのフォーム送信を防止

            addWordMessage.style.display = 'none';
            addWordError.style.display = 'none';

            const wordInput = document.getElementById('word');
            const meaningInput = document.getElementById('meaning');

            const newWord = wordInput.value.trim();
            const newMeaning = meaningInput.value.trim();

            if (!newWord || !newMeaning) {
                addWordError.textContent = '単語と意味の両方を入力してください。';
                addWordError.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(`/api/vocab/${filename}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },

                    // データの値をJSON形式に変換する
                    body: JSON.stringify({ word: newWord, meaning: newMeaning })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                // 成功メッセージを表示
                addWordMessage.textContent = '単語が追加されました！';
                addWordMessage.style.display = 'block';

                // フォームをクリア
                wordInput.value = '';
                meaningInput.value = '';

                // テーブルを再読み込みして最新の状態を表示
                fetchAndDisplayVocab();

            } catch (error) {
                console.error('Error adding word:', error);
                addWordError.textContent = `単語の追加中にエラーが発生しました: ${error.message}`;
                addWordError.style.display = 'block';
            }
        });
    }
});