## インストール
VisualStudioCodeをインストール 
Pythonをインストール

## プログラムのクローン
このページからCodeをクローン

## ライブラリのインストール
powershell を開く

（仮想環境を作る）
pip3 install virtualenv
virtualenv env
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

（仮想環境に入る）
.\env\Scripts\Activate.ps1
pip3 install flask python-dotenv openai

## 実行
app.pyからプログラムを実行
pythonのターミナルからURLにアクセス
