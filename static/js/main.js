// ファイルがすべて読み込まれたときに実行する
document.addEventListener('DOMContentLoaded', () => {
    const vocabTableBody = document.querySelector('#vocab-table tbody');        //テーブルの行
    const addWordForm = document.getElementById('add-word-form');               //データ追加フォーム
    const loadingMessage = document.getElementById('loading-message');          //NOW LOADING...表示
    const errorMessage = document.getElementById('error-message');              //ERROR表示
    const noWordsMessage = document.getElementById('no-words-message');         //単語がまだない時の表示
    const addWordMessage = document.getElementById('add-word-message');         //単語が追加されたときの表示
    const addWordError = document.getElementById('add-word-error');             //単語が追加されなかったときの表示
    const chatButton = document.getElementById('chat'); // GPTボタンを取得

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
                document.getElementById('vocab-table').style.display = 'none'; // テーブルを非表示
            } else {
                noWordsMessage.style.display = 'none';
                document.getElementById('vocab-table').style.display = 'table'; // テーブルを表示

                // データをひとつずつ処理
                words.forEach((wordEntry, index) => {
                    const row = vocabTableBody.insertRow();     // 行追加

                    // 単語セル
                    const wordCell = row.insertCell();          
                    wordCell.textContent = wordEntry.word;
                    wordCell.classList.add('editCell');
                    wordCell.dataset.originalWord = wordEntry.word;

                    // 意味セル
                    const meaningCell = row.insertCell();
                    meaningCell.textContent = wordEntry.meaning;
                    meaningCell.classList.add('editCell');
                    meaningCell.dataset.originalMeaning = wordEntry.meaning;

                    // 評価ラジオボタンセル
                    const radioCell = row.insertCell();
                    const levels = [
                        {color: 'green', label: '◎'},
                        {color: 'yellow', label: '△'},
                        {color: 'red', label: '✕'}
                    ];

                    levels.forEach(level => {
                        const label = document.createElement('label');
                        label.style.marginRight = '8px';
                        label.style.whiteSpace = 'nowrap';

                        const radio = document.createElement('input');
                        radio.type = 'radio';
                        radio.name = `rating-${index}`; // 行ごとに分けたラジオボタン
                        radio.value = level.color;

                        if (wordEntry.rating === level.color) {
                            radio.checked = true;
                        }

                        
                        // radio.addEventListener('change', () => {
                        //     localStorage.setItem(`rating-${index}`, level.color);
                        // });

                        radio.addEventListener('change', async () => {
                            const newRating = level.color;

                            // 単語と意味を取得（セルから）
                            const row = radio.closest('tr');        // radioの先祖要素のtr
                            const word = row.cells[0].textContent;
                            const meaning = row.cells[1].textContent;

                            try {
                                await fetch(`/api/vocab/${filename}`, {
                                method: 'PUT',  // 更新用メソッド
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                //word を特定して ratingを書き換え
                                body: JSON.stringify({ word, meaning, rating: newRating })  // word,meaningが一致する行のratingを変更
                                });
                            } catch (err) {
                                console.error('評価の保存に失敗:', err);
                            }
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
                    deleteCell.classList.add('buttonCell');

                    deleteButton.addEventListener('click', async() =>{

                        const row = deleteButton.closest('tr');     //先祖のtr要素
                        const word = row.cells[0].textContent;
                        const meaning = row.cells[1].textContent;
                        // const rating = row.cells[2].textContent; 

                        try {
                            const response = await fetch(`/api/vocab/${filename}`, {
                                method: 'DELETE',  // 更新用メソッド
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ word, meaning }) 
                            });
                            // const result = await response.json(); // 必要であれば結果を処理

                            if (response.ok) {
                                row.remove();    //行削除反映
                                // 削除後に単語が0になった場合の表示を更新するために再フェッチ
                                fetchAndDisplayVocab(); 
                            } else {
                                const errorData = await response.json();
                                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                            }

                        } catch (err) {
                            console.error('単語の削除に失敗:', err);
                            alert(`単語の削除に失敗しました: ${err.message}`); // エラーメッセージをユーザーに表示
                        }
                    });


                    deleteCell.appendChild(deleteButton);

                    const retryCell = row.insertCell();
                    const retryButton = document.createElement('button');
                    retryButton.textContent = '再生成';
                    retryCell.classList.add('buttonCell');

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

    // GPTボタンのイベントリスナーをここに追加 (addWordFormのイベントリスナーの外)
    
    // GPTへのリクエストはGPTボタンを押したときだけ実行するように変更
    // レートリミット(429)対策：ボタンの無効化と再有効化を追加

    chatButton.addEventListener('click', async (event) => {
        event.preventDefault();

        const wordInput = document.getElementById('word');
        const meaningInput = document.getElementById('meaning');
        const newWord = wordInput.value.trim();

        if (!newWord) {
            alert('単語を入力してください。');
            return;
        }

        // ボタン無効化（連打防止）
        chatButton.disabled = true;
        chatButton.textContent = '生成中...';

        // オプションの取得
        const style = document.querySelector('input[name="outputStyle"]:checked')?.value || '箇条書き';
        const type = document.querySelector('input[name="outputType"]:checked')?.value || '短く';
        const length = document.getElementById('outputLength').value || '設定なし';
        const count = document.getElementById('outputCount').value || '1件';

        const promptMessage = `${filename}について${newWord}の意味。\n出力形式：テキストで意味の内容のみ。ポイントを抑えて${style}。${newWord}を主語として含めない。\n出力件数: 意味${count}件\n文体: ${type}\n出力条件: ${style}、${length === '設定なし' ? '' : `1件あたりの目安文字数: ${length}字程度`}`;
        // 出力はJSON形式で、値はテキスト形式で条件の内容のみ。例：\n\n{\n  \"意味\": string,\n  \"実例\": string,\n }"},
        
        console.log(filename);

        try {
            meaningInput.value = 'GPTが意味を生成中...';

            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: promptMessage })
            });

            if (response.status === 429) {
                throw new Error('OpenAIレートリミットエラー: しばらく待ってから再試行してください。');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(data);
            const gptMeaning = data.meaning || '(意味なし)';
            const newMeaning = gptMeaning.replace(/-/g, "");
            const trimMeaning = newMeaning.trim();
            meaningInput.value = trimMeaning;

        } catch (err) {
            console.error('GPTからの意味取得に失敗:', err);
            meaningInput.value = '意味の取得に失敗しました。';
            alert(`GPTからの意味取得に失敗しました: ${err.message}`);

        } finally {
            // 5秒後にボタンを再有効化
            setTimeout(() => {
                chatButton.disabled = false;
                chatButton.textContent = 'GPTで意味生成';
            }, 5000);
        }
    });

    // 単語追加処理側（submitイベント）では、GPTは呼ばない！
    // すでに入力された意味をそのまま保存するだけ


    // 単語追加フォームの送信イベントリスナー
    // form要素があれば
    if (addWordForm) {
        addWordForm.addEventListener('submit', async (event) => {       // ボタン監視
            event.preventDefault(); // ページの再読み込みを防止

            addWordMessage.style.display = 'none';
            addWordError.style.display = 'none';

            const wordInput = document.getElementById('word');
            const meaningInput = document.getElementById('meaning'); // 意味入力フィールドを取得

            const newWord = wordInput.value.trim();
            const newMeaning = meaningInput.value.trim(); // フォームから意味を取得

            // 値がない時の処理 (GPTボタンで意味が入力される前提なので、意味が空でも続行できるようにするなら変更)
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
        // 編集可能なセルかつ編集中でない場合
        if (target.tagName.toLowerCase() === 'td' && !target.classList.contains('editing') && target.classList.contains('editCell')) {
            const originalText = target.textContent;
            target.classList.add('editing');

            // input要素作成
            const input = document.createElement('input');
            input.type = 'text';
            input.value = originalText;

            // tdの中身を空にしてinputを入れる
            target.textContent = '';
            target.appendChild(input);

            input.focus();
            // input.select();

            // 編集終了処理
            const finishEditing = async () => {
                const newValue = input.value.trim();
                target.textContent = newValue || '(空です)';
                target.classList.remove('editing');

                // 変更がなければ何もしない
                if (newValue === originalText) {
                    return;
                }

                const row = target.closest('tr');
                const wordCell = row.cells[0];
                const meaningCell = row.cells[1];

                let originalWord = wordCell.dataset.originalWord; 
                let originalMeaning = meaningCell.dataset.originalMeaning;

                // どのセルが編集されたかによって送信するデータを変える
                let dataToSend = {};
                let url = '';
                
                // 単語セルが編集された場合
                if (target === wordCell) {
                    dataToSend = { word: newValue }; // 変更された単語のみを送信
                    url = `/api/vocab/${filename}/${encodeURIComponent(originalWord)}/${encodeURIComponent(originalMeaning)}`;
                    wordCell.dataset.originalWord = newValue; // 更新後の値をoriginalWordとして保存
                } 
                // 意味セルが編集された場合
                else if (target === meaningCell) {
                    dataToSend = { meaning: newValue }; // 変更された意味のみを送信
                    url = `/api/vocab/${filename}/${encodeURIComponent(originalWord)}/${encodeURIComponent(originalMeaning)}`;
                    meaningCell.dataset.originalMeaning = newValue; // 更新後の値をoriginalMeaningとして保存
                }

                try {
                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(dataToSend)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    }
                    console.log('更新成功:', await response.json());
                    // fetchAndDisplayVocab();
                } catch (error) {
                    console.error('更新に失敗:', error);
                    alert(`更新に失敗しました: ${error.message}`);
                    target.textContent = originalText; // エラー時は元のテキストに戻す

                    if (target === wordCell) {
                        wordCell.dataset.originalWord = originalText;
                    } else if (target === meaningCell) {
                        meaningCell.dataset.originalMeaning = originalText;
                    }
                }
            };

            // エンターキーで終了
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    finishEditing();
                }
            });

            const canselEditing = () => {
                target.textContent = originalText;
                target.classList.remove('editing');
            }

            // フォーカスが外れたら終了
            input.addEventListener('blur', () => {
                canselEditing();
                // finishEditing();
            });
        }
    });

    const outputLength = document.getElementById('outputLength');
    const outputCount = document.getElementById('outputCount');

    
    for(let i = 10; i <= 100; i += 10){
        const lengthOption = document.createElement('option');
        lengthOption.value = i;
        lengthOption.textContent = `${i}字程度`
        outputLength.appendChild(lengthOption);
    }

    for(let i = 1; i <= 5; i++ ){
        const countOption = document.createElement('option');
        countOption.value = i;
        countOption.textContent = `${i}件`
        outputCount.appendChild(countOption);
    }

    const openModal = document.getElementById('openModal');
    const closeModal = document.getElementById('closeModal');
    const optionModal = document.getElementById('optionModal');

    openModal.addEventListener('click', () => {
        optionModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', ()=> {
        optionModal.style.display = 'none';

        const checkedStyleRadio = document.querySelector('input[name = "outputStyle"]: checked')
        if (checkedStyleRadio) {
            localStorage.setItem('checkedStyleRadio', checkedStyleRadio.value);
        }
    });

    const savedRadio = localStorage.getItem('checkedStyleRadio');
    if (savedRadio) {
        const targetRadio = document.querySelector(`input[name = "outputStyle"][value = "${savedRadio}"]`);
        if(targetRadio) {
            targetRadio.checked = true;
        }
    }

    
});
