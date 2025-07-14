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
            const response = await fetch(`/api/vocab/${filename}`);     //GETメソッドのみ通信
            if (!response.ok) {     
                // 存在しない単語帳を開いたとき
                if (response.status === 404) {
                    noWordsMessage.textContent = 'この単語帳は存在しません。';
                    noWordsMessage.style.display = 'block';
                    loadingMessage.style.display = 'none';
                    return;
                }
                // 404以外のエラー
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // fetch の response をjson形式で受け取る
            const words = await response.json();

            // 単語がない時・ある時
            if (words.length === 0) {
                noWordsMessage.style.display = 'block';
                document.getElementById('vocab-table').style.display = 'none'; // CSS操作　テーブルを非表示
            } else {
                noWordsMessage.style.display = 'none';
                document.getElementById('vocab-table').style.display = 'table'; // CSS操作　テーブルを表示

                // データをひとつずつ処理
                words.forEach((wordEntry, index) => {
                    const row = vocabTableBody.insertRow();     // 行追加

                    // 単語セル
                    const wordCell = row.insertCell();          
                    wordCell.textContent = wordEntry.word;

                    // 意味セル
                    const meaningCell = row.insertCell();
                    meaningCell.textContent = wordEntry.meaning;

                    // 評価ラジオボタンセル
                    const radioCell = row.insertCell();
                    const levels = [
                        {color: 'green', label: '◎'},
                        {color: 'yellow', label: '〇'},
                        {color: 'red', label: '△'}
                    ];

                    const savedRating = localStorage.getItem(`rating-${index}`);

                    levels.forEach(level => {
                        const label = document.createElement('label');
                        label.style.marginRight = '8px';

                        const radio = document.createElement('input');
                        radio.type = 'radio';
                        radio.name = `rating-${index}`; // 行ごとに分けたラジオボタン
                        radio.value = level.color;

                        if (savedRating === level.color) {
                            radio.checked = true;
                        }

                        radio.addEventListener('change', () => {
                            localStorage.setItem(`rating-${index}`, level.color);
                        });

                        label.appendChild(radio);

                        const span = document.createElement('span');
                        span.textContent = level.label;
                        span.style.color = level.color;
                        label.appendChild(span);

                        radioCell.appendChild(label);
                    });

                    const deleteCell = row.insertCell();
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = '削除';

                    deleteCell.appendChild(deleteButton);

                    const retryCell = row.insertCell();
                    const retryButton = document.createElement('button');
                    retryButton.textContent = 'リトライ';

                    retryCell.appendChild(retryButton);
                });
            }
        } catch (error) {
            console.error('Error fetching vocabulary:', error);
            errorMessage.textContent = `単語帳の読み込み中にエラーが発生しました: ${error.message}`;
            errorMessage.style.display = 'block';
            document.getElementById('vocab-table').style.display = 'none'; // テーブルを非表示
        } finally {
            loadingMessage.style.display = 'none';      //　最後にLOADING...を非表示
        }
    };

    // ページロード時に単語データを取得して表示
    fetchAndDisplayVocab();

    // 単語追加フォームの送信イベントリスナー
    // form要素があれば
    if (addWordForm) {
        addWordForm.addEventListener('submit', async (event) => {       // ボタン監視
            event.preventDefault(); // ページの再読み込みを防止

            addWordMessage.style.display = 'none';
            addWordError.style.display = 'none';

            const wordInput = document.getElementById('word');
            const meaningInput = document.getElementById('meaning');

            // 入力した値
            const newWord = wordInput.value.trim();
            const newMeaning = meaningInput.value.trim();

            // 値がない時の処理
            if (!newWord || !newMeaning) {
                addWordError.textContent = '単語と意味の両方を入力してください。';
                addWordError.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(`/api/vocab/${filename}`, {        //　POSTメソッド（追加用）を通信
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },

                    // データの値をJSON形式に変換して、body: をfetchに送信
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
    const table = document.getElementById('vocab-table');
    

    table.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target.tagName.toLowerCase() === 'td' && !target.classList.contains('editing')) {
        // 編集中なら何もしない

        const currentText = target.textContent;
        target.classList.add('editing');

        // input要素作成
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;

        // tdの中身を空にしてinputを入れる
        target.textContent = '';
        target.appendChild(input);

        input.focus();
        input.select();

        // 編集終了処理
        function finishEditing() {
            const newValue = input.value.trim();
            target.textContent = newValue || '(空です)';
            target.classList.remove('editing');
        }

        // エンターキーで終了
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
            finishEditing();
            }
        });

        // フォーカスが外れたら終了
        input.addEventListener('blur', () => {
            finishEditing();
        });
        }
    });
});