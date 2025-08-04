'''
rpa Version 2.1.0（2025.07.23）
'''

import pandas as pd
import pyautogui as pg
pg.useImageNotFoundException()
import pyperclip
import cv2
import numpy as np

import matplotlib.pyplot as plt
# import japanize_matplotlib
from matplotlib import patches
import tkinter as tk
from tkinter import Tk, messagebox
from sklearn.ensemble import RandomForestClassifier

import time
from PIL import Image # 背景画像
import re # 正規表現
import random # 乱数
import pyocr # OCR
import pyocr.builders # OCR
from PIL import Image, ImageTk

import csv
import datetime
import os
import math

from abc import ABCMeta, abstractmethod # 抽象クラスを使用するとき。
import unicodedata # 丸数字を数字に変換。

# デザインパターンに関する参考サイト
# https://qiita.com/ttsubo/items/475ac4810ae44c0ea1bd
# https://nishi2.info/pydp/GoF_dp/behavior/22_Template_Method/index.html


def main():

    # tesseractが認識されないときは、パスを通す必要がある。
    # TesseractのインストールPATHを設定
    pyocr.tesseract.TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    # グローバル変数の定義
    # clf = None
    selected_label = None
    selected_index = None
    # root = None
    # content_frame = None

    global clf, root, content_frame
    clf = initialize_model()

    root = tk.Tk()
    root.title("AIボタン検出ツール")
    root.geometry("300x500")
    root.configure(bg="white")

    menu_bar = tk.Menu(root)
    menu_action = tk.Menu(menu_bar, tearoff=0)
    menu_action.add_command(label="ボタン検出", command=run_detection)
    menu_action.add_command(label="ボタン検査", command=run_inspection)
    menu_action.add_command(label="終了", command=root.quit)
    menu_bar.add_cascade(label="操作", menu=menu_action)
    root.config(menu=menu_bar)

    content_frame = tk.Frame(root, bg="white")
    content_frame.pack(fill="both", expand=True)

    initial_label = tk.Label(content_frame, text="メニューから『ボタン検出』を選んでください",
                             bg="white", fg="gray", font=("Arial", 12))
    initial_label.pack(pady=40)

    root.mainloop()

def run_inspection(): # 単体テスト。

    # ★★★テスト時の条件選択★★★
    mode = 1 #（0:本番、1:region_preparation、2:locate_test、3:region_test）
    job = 0 #（0:test、1:予備、2:login、3:set_select、4:set_in、5:temp、6:set_out、7:logoff）
    settting_val = 4
    num_conf = 21 # test時、発生させる乱数の数。「0:本番」のときは1にすること。
    btn_name = 'google'
    # ★★★★★★★★★★
    

    # regionの読み込み。
    df_region = pd.read_csv('region.csv',encoding='shift jis') # regionマスタの読み込み。

    # メッセージ
    # box = Tk()
    # box.attributes('-topmost', True) # boxを最前面に移動。
    # box.withdraw() 
    # messagebox.showinfo('メッセージ', '検査する画面を全画面表示してください。')

    '''
    # jobの分岐

    if job == 0:
        obj = Panel().test(btn_name, df_region, mode, num_conf)
    elif job == 2:
        obj = Panel().login(df_region, mode, num_conf)
    elif job == 3:
        obj = Panel().set_select(btn_name, df_region, mode, num_conf)        
    elif job == 4:
        obj = Panel().set_in(btn_name, df_region, mode, num_conf)
    elif job == 5:
        obj = Panel().temp(df_region, settting_val, mode, num_conf)
    elif job == 6:
        obj = Panel().set_out(btn_name, df_region, mode, num_conf)
    elif job == 7:
        obj = Panel().logoff(df_region, mode, num_conf)
    '''

    def handle_name_selected(name):
        print(f"選択された保存名: {name}")
        obj = Panel().test(name, df_region, mode, num_conf)

    # 例: 名前リストを読み込んでポップアップを表示
    name_options = load_name_options_from_csv()
    show_name_selection_popup(name_options, handle_name_selected)
        

class Panel() : # 本番時は、このクラスを外から呼び出す。

# job毎に、サブクラス'Auto***'を記述
# 外部から呼び出す場合はmodeを省略（mode=0）

    # def test(self, df_region, mode=0, num_conf=1) :
    def test(self, btn_name, df_region, mode=0, num_conf=1) :
       
        # Mode = AutoImageOcr('google', df_region, mode, num_conf).execut()
        # print(Mode)
        AutoImageClick(btn_name, df_region, mode, num_conf).execut()


    def login(self, df_region, mode=0, num_conf=1, panel_url=None) :

        time.sleep(2.0)
        # pg.hotkey('win','1')
        AutoImageClick('google', df_region, mode, num_conf).execut()
        time.sleep(2.0)
        

        # ★★★★★現在の日付と時刻を取得
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")  # "YYYYMMDD_HHMMSS" 形式

        # 保存するデータ
        data = [
            ["名前", "年齢", "職業"],
            ["田中", 28, "エンジニア"],
            ["佐藤", 35, "デザイナー"],
            ["鈴木", 42, "マーケター"]
        ]

        folder_name = "test"
        os.makedirs(folder_name, exist_ok=True)  # フォルダが存在しない場合は作成

        # ファイル名にタイムスタンプを追加
        # csv_file = f"output_{timestamp}.csv"
        csv_file = os.path.join(folder_name, f"output_{timestamp}.csv")


        # CSVファイルを保存
        with open(csv_file, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerows(data)

        print(f"{csv_file} にデータ★★★★★を保存しました★★★★★")
        # ★★★★★


        
        
        # AutoImageClick('daikin', df_region, mode, num_conf).execut()
        # time.sleep(1.0)
        
        # AutoTextStr('http://192.168.1.250/', mode).execut()
        AutoTextStr(panel_url, mode).execut()
        
        time.sleep(2.0)
        pg.press('enter')
        time.sleep(1.0)

        AutoImageClick('user', df_region, mode, num_conf).execut()
        time.sleep(1.0)
        AutoTextStr('shibuya', mode).execut()
        time.sleep(0.5) 
        pg.press('tab')
        time.sleep(0.5) 
        AutoTextStr('pckkpckk', mode).execut()
        AutoImageClick('login', df_region, mode, num_conf).execut()
        AutoImageClick('sita', df_region, mode, num_conf).execut()
        AutoImageClick('situnaiki', df_region, mode, num_conf).execut()
        AutoImageClick('sita', df_region, mode, num_conf).execut()

    def set_select(self, btn_name, df_region, mode=0, num_conf=1) :
    
        # 室内機選択画面。
        AutoImageClick(btn_name, df_region, mode, num_conf).execut()
        Power = AutoImageOcr('startstop', df_region, mode, num_conf).execut()
        if Power == '運転' :
            Power = 'on'
        else :
            Power = 'off'

        text = AutoImageOcr('hotcold', df_region, mode, num_conf).execut()
        if text == '冷房' :
            HotcoldMode = 'cold'
        elif text == '暖房'  :
            HotcoldMode = 'hot'
        else :
            HotcoldMode = 'air'            

        print('HotcoldMode=', HotcoldMode)

        # s = AutoImageOcr('internaltemp', df_region, mode, num_conf).execut()
        # 以下は不要か。評価中。
        # ss0 = unicodedata.normalize('NFKC', s[0])
        # ss1 = unicodedata.normalize('NFKC', s[1])
        # ss3 = unicodedata.normalize('NFKC', s[1])
        # InternalTemp = float(ss0 + ss1 + ss3)/10
        # InternalTemp = float(s)
        # print('InternalTemp（floatに変換後）=',InternalTemp)

        s = AutoImageOcr('panelindoortemp', df_region, mode, num_conf).execut()
        PanelIndoorTemp = float(s)
        # print('PanelTemp（floatに変換後）=',PanelTemp)

        s = AutoImageOcr('panelsettemp', df_region, mode, num_conf).execut()
        try:
            PanelSetTemp = float(s)
        except (NameError, ValueError):
            PanelSetTemp = math.nan
        
        return Power, PanelIndoorTemp, PanelSetTemp, HotcoldMode


    def set_in(self, btn_name, df_region, mode=0, num_conf=1) :
    
        # 詳細ボタン。
        AutoImageClick('sousa', df_region, mode, num_conf).execut()

    def temp(self, df_region, settting_val, mode=0, num_conf=1) :

        # 温度設定
        AutoImageClick('kuutyouki', df_region, mode, num_conf).execut()
        AutoImageClick('temp', df_region, mode, num_conf).execut()
        AutoImageClick('henkou', df_region, mode, num_conf).execut()
        # テキストフィールドをフォーカスするため、'clear'をクリック。
        AutoImageClick('clear', df_region, mode, num_conf).execut()
        AutoTextFloat(settting_val, mode).execut()
        # AutoImageClick('cancel-temp', df_region, mode, num_conf).execut() # テスト用
        AutoImageClick('ok-temp', df_region, mode, num_conf).execut() # 本番用

    def set_out(self, btn_name, df_region, mode=0, num_conf=1) :
    
        # 設定画面から戻り室内機選択画面へ。
        AutoImageClick('cancel-all', df_region, mode, num_conf).execut() # テスト用
        # AutoImageClick('ok-all', df_region, mode, num_conf).execut() # 本番用  
        # AutoImageClick('hai', df_region, mode, num_conf).execut() # 本番用 

    def logoff(self, df_region, mode=0, num_conf=1) :

        pg.scroll(-1000) # 下スクロール
        AutoImageClick('logoff', df_region, mode, num_conf).execut()
        AutoImageClick('hai', df_region, mode, num_conf).execut()
        pg.keyDown('ctrl')
        pg.press('w')
        pg.keyUp('ctrl')
        

'''
def flow_setting(df_region, settting_val, mode=0, num_conf=1): # 外部から呼び出す場合はmodeを省略（mode=0）

    # 風量設定
    # 'flowicon'画像から現在値（枝番）を取得。
    obj = AutoImageClick('flowicon', df_region, mode, num_conf).execut()
    print('◆obj=',obj)
    # 上矢印'flowarrow'を必要回数分クリック。    
    obj = AutoImageClickMulti('flowarrow', df_region, obj, settting_val, mode, num_conf).execut()  
'''

class Auto(metaclass=ABCMeta):
# スーパークラス（抽象クラス）

    @abstractmethod
    def preparation (self) :
        pass        

    @abstractmethod
    def region (self) :
        pass

    @abstractmethod
    def locate (self) :
        pass

    @abstractmethod
    def calc (self) :
        pass

    @abstractmethod
    def optimization (self) :
        pass

    @abstractmethod
    def setting (self) :
        pass

    @abstractmethod
    def graph (self) :
        pass

    def execut(self):

        mode = self.mode
        # modeの分岐（メソッドの呼び出し）。
        match mode :
            case 0 :
                # self.preparation()
                self.region()
                self.locate()
                self.calc()
                # self.optimization()
                self.setting()
                # self.graph()
            case 1 :
                self.preparation()
                self.region()
                self.locate()
                self.calc()
                self.optimization()
                self.setting()
                self.graph()
            case 2 :
                # self.preparation()
                self.region()
                self.locate()
                self.calc()
                self.optimization()
                self.setting()
                self.graph()
            case 3 :
                # self.preparation()
                self.region()
                # self.locate()
                # self.calc()
                # self.optimization()
                # self.setting()
                self.graph()

        # 異常終了（pがNone）ときの対応をどうするか。
        print('■btn=',self.btn)

        if mode != 3 :
            print('□value=',self.value)
            return self.value


class AutoImage(Auto):
# サブクラス（２階層目）

    def preparation(self):
        
        def on_region_selected(region):
            # region = [x, y, width, height]
            btn = self.btn
            range_region = region

            df_region = pd.read_csv('region.csv', encoding="shift-jis")
            id_list = df_region.index[df_region['btn'] == btn].tolist()

            df_region.loc[id_list[0], 'left'] = range_region[0]
            df_region.loc[id_list[0], 'top'] = range_region[1]
            df_region.loc[id_list[0], 'width'] = range_region[2]
            df_region.loc[id_list[0], 'height'] = range_region[3]
            df_region.to_csv('region.csv', index=False, encoding="shift-jis")

            messagebox.showinfo('メッセージ', 'regionの座標を更新しました。')
            self.df_region = df_region

        # callback関数を渡して呼び出す
        get_region_by_drag(on_region_selected)
   
    def region (self) :
    # region（領域）の読み込み。
        btn =  self.btn
        df_region = self.df_region
        # print('df_region====', df_region)
        id_list = df_region.index[df_region['btn'] == btn].tolist() # 該当btnのindexを取得。
        # print('id_list====', id_list)
        region = []
        region.append(df_region.loc[id_list[0],'left'])
        region.append(df_region.loc[id_list[0],'top'])
        region.append(df_region.loc[id_list[0],'width'])
        region.append(df_region.loc[id_list[0],'height'])
        region.append(df_region.loc[id_list[0],'cx'])
        region.append(df_region.loc[id_list[0],'cy'])
        region.append(df_region.loc[id_list[0],'w'])
        region.append(df_region.loc[id_list[0],'h'])
        

        # print('読み込んだregion=',region)

        num = df_region.loc[id_list[0],'num']
        cycle = df_region.loc[id_list[0],'cycle']
        conf = df_region.loc[id_list[0],'conf']

        self.region = region
        self.num = num
        self.cycle = cycle
        self.conf = conf

    def graph (self) :

        mode = self.mode
        btn =  self.btn
        region = self.region
        if hasattr(self, 'locate_list1'):
            locate_list1 = self.locate_list1
        num = self.num
   
        # 表示（共通）
        fig, ax1 = plt.subplots()
        fig.set_size_inches((11.69,8.27))
        plt.get_current_fig_manager().window.wm_geometry("+0+0") # 表示位置

        username = os.getlogin()
        path = f'C:/Users/{username}/aircon/btn/test/screenshot.png'

        # csv_path = f'C:/Users/{username}/aircon/region.csv'
        # df_region = pd.read_csv(csv_path)

        screenshot = pg.screenshot()
        # screenshot.save('C:/Users/hp/aircon/btn/test/screenshot.png')
        # im = Image.open('C:/Users/hp/aircon/btn/test/screenshot.png')
        screenshot.save(path)
        im = Image.open(path)

        ax1.imshow(im, alpha=0.6)

        ax1.set_xlim([0, 1920])
        ax1.set_ylim([1080, 0])

        ax2 = ax1.inset_axes([0, 1.05, 1, 0.05])
        ax2.set_xlim([0, 1])
        ax2.set_ylim([2, 0])

        # region
        if isinstance(region, list): # regionに値が入っているか（listであるか）の判定。
            r1 = patches.Rectangle(
                (region[0],region[1]), region[2], region[3],
                 fill=False, edgecolor="green", linewidth=1.0, linestyle = 'solid'
                )
            ax1.add_patch(r1) # regionの四角形を設定。
            
            # 中心座標(cx, cy)をドットで表示
            cx, cy = region[4], region[5]
            ax1.plot(cx, cy, marker='o', color='green', markersize=1)  # 小さな緑色の円。


        # locate
        # region_test（領域のみのテスト）の場合locate_list1は存在しないので、以下のグラフ処理を省く。

        if hasattr(self, 'locate_list1'): # selfの中にlocate_list1が存在するかの判定。

            j = 0
            for locate_list2 in locate_list1 :

                if num == 1 :
                    j = ''
                else :
                    j += 1    
                # print('graph_locate_list2=',locate_list2)        
                for locate in locate_list2 :
                    conf = locate[4] # locate[4]にconf(0.00～1.00）が入っている
                    detect = locate[5] # 検知のとき0、未検知または誤検知のとき7（白抜きの直径）が入っている 
                    rgb = (abs(1-conf),0,conf) # conf=1のとき青(0,0,1)、conf=0のとき赤(1,0,0)、中間は紫(0.5,0,0.5)
                    # print('graph_locate=',locate)
                    r2 = patches.Rectangle(
                        (locate[0], locate[1]), locate[2], locate[3],
                          fill=False, edgecolor = rgb, linewidth=0.5, linestyle = 'dashed'
                        )   
                    ax1.add_patch(r2) # locateの四角形を設定。
                    ax2.scatter(conf, 1, color = rgb, s=30) # 認識率表示。
                    ax2.scatter(conf, 1, color = 'w', s=detect) # 未検知または誤検知のとき白抜き。
                    
                plt.show() # fig.show()でも同じ？。
                fig.savefig('btn/verification/'+ btn + str(j) + '.png', dpi=100) # Test_dataで保存を入れると遅くなる。
        else :
            print('領域のみなのでlocate_list1は存在しない。')
            plt.show() # fig.show()でも同じ？。
            fig.savefig('btn/verification/'+ btn + '.png', dpi=100) # Test_dataで保存を入れると遅くなる。


class AutoText(Auto):
# サブクラス（２階層目）

    def __init__(self, settting_val, mode):

        self.btn = 'テキスト入力' # 確認用。
        self.settting_val = settting_val
        self.mode = mode
        self.conf = 0.8 # ←確認要。マスタのconfとどちらを優先させるか。
        # Autoクラスのexecutメソッドでlocate_valを返すため、デフォルト値を設定しておく。
        # self.locate_val = None

    def preparation (self) :
        pass

    def region (self) :
        pass

    def locate (self) :
        pass        

    def calc (self) :
        pass

    def optimization (self) :
        pass

    def setting (self) :
        pass

    def graph (self) :
        pass


# サブクラス（３階層目）

class AutoImageClick(AutoImage):

    def __init__(self, btn, df_region, mode, num_conf) :

        self.btn = btn
        self.df_region = df_region
        self.mode = mode
        self.num_conf = num_conf
        self.t = 1 # クリック回数=1（デフォルト値）


    def locate (self) :
        btn =  self.btn
        region = self.region
        num = self.num # 複数画像の場合の画像の個数
        num_conf = self.num_conf
        conf = self.conf

        locate = [] # ボタン画像を認識できた場合、ここに座標のlistが入る。
        locate_val = ''
        count = 0
        p = None
        val = 0

        base_dir = os.path.join("C:/Users", os.getlogin(), "aircon", "btn")

        # 複数画像時、for文で使う枝番jのイテレータを生成。
        if num == 1 : # 単一画像のとき
            iter_num = [''] # 単一画像のとき、枝番は無い。
        else : # 複数画像のとき
            nums = list(range(int(num))) # [0,1,2,3] 
            iter_num = [x + 1 for x in nums] # 配列numsのすべての要素に1を加算。 [1,2,3,4]

        # confidence_test時、confイテレータを生成。
        iter_conf = []
        if num_conf == 1 : # num_confが１のとき。＝本番のとき（検査でないとき）。
            iter_conf = [conf] # regionマスタから読み込んだconf
        else :
            for num in range(num_conf): # num_confは、生成するconfの乱数の数。
                # iter_conf.append(int((random.random())*100)/100) # 乱数（0.00～1.00）
                conf = round(num / (num_conf - 1), 2) # 順列パターン。
                iter_conf.append(conf) # 順列パターン。
            # random.shuffle(iter_conf)  # 要素の順序をランダムに並び替え



        # ボタン事前認識のためのループ。
        # locateに値がない場合、5回までリトライする。
        # 5回を超えた場合のエラー処理検討要。
        # ループ回数は外側から変えられるようするか。（別途検討）。

        while p is None and count < 5 :

            count += 1
            print('*count=',count)

            locate_list1 = []
            
            # 複数画像対応のためのループ。
            for j in iter_num : # num=1のとき、ループは1回のみ。

                print('*j=',j) # 確認用。
                
                time.sleep(0.3) # 外側から変えられるようにするか要検討。
                time_s = time.time() # 処理時間測定開始。

                # btn_name = "C:/Users/hp/aircon/btn/" + btn + str(j) +'.png' # ボタン画像の名称。
                btn_name = os.path.join(base_dir, btn + str(j) + ".png")
                
                locate_list2 = []

                for conf in iter_conf :

                    print('*btn_name=',btn_name)
                    print('conf=',conf)
                    print('region=',region)

                    try :
                        p = pg.locateOnScreen(
                            btn_name,
                            confidence = conf,
                            region = region, # 範囲座標。
                            )
                    except pg.ImageNotFoundException:
                        print('画像を認識できませんでした。')
                        # locate = [10,10,100,100,conf] # ←乱数生成時。
                        # locate = [10,10,100,100,conf,10] # ←画面左上に四角形を表示。5番目に10（白抜きの〇の直径）。
                        locate = [0,0,0,0,conf,7] # ←画面左上に四角形を表示。5番目に7（白抜きの〇の直径）。
                        pg.sleep(0.5)

                    else :
                        locate_val = j # 画像枝番jをval（現在の値）に格納。
                        locate = [p[0],p[1],p[2],p[3],conf,0] # 認識した座標。4番目にconf、5番目に0。
                        locate_cx = locate[0] + locate[2] // 2
                        locate_cy = locate[1] + locate[3] // 2
                        if abs(region[4] - locate_cx) < region[6] and abs(region[5] - locate_cy) < region[7]:
                            print('正常認識')
                        else :
                            print('誤認識')
                            locate[5] = 6
                            
                    locate_list2.append(locate) # locateの配列に要素を追加。

                # print('*locate_list2=\n',locate_list2)

                time_e = time.time() # 処理時間測定終了。
                locate_time = round(time_e - time_s, 3) # 処理時間計算。

                locate_list1.append(locate_list2)               

            # print('*locate_list1=\n',locate_list1)
            # print('*locate_val=',locate_val)
            # self.p = p
            self.locate = locate # 暫定仕様：最終のlocateをcaptureに渡す。←これはだめ。
            self.locate_list1 = locate_list1
            self.locate_time = locate_time
            self.locate_val = locate_val
            self.iter_num = iter_num


    def calc (self) :
        pass

    def optimization (self) : # 試行段階。最頻値を取得。 
        
        locate_list1 = self.locate_list1
        
        for locate_list2 in locate_list1 :

            columns_name = ['left','top','width','height','conf','result']
            df = pd.DataFrame(locate_list2, columns= columns_name)
            df = df.sort_values('conf')
            print('★df=',df)
            df = df.mode() # 最頻値を取得する。
            locate = df.iloc[0].to_list()
            locate[4] = 0.9
            print('★opt_locate=',locate)

        self.locate = locate        
        
    def setting (self) :

        locate = self.locate
        print('★settinglocate=',locate)
        t = self.t
        i = 1
        x, y = pg.center(locate)
        pg.click(x, y, clicks = t, interval = i)

        self.value = self.locate_val # Autoのreturn文で返す値。


class AutoImageOcr(AutoImage): # OCR認識

    def __init__(self, btn, df_region, mode, num_conf) :

        self.btn = btn
        self.df_region = df_region
        self.mode = mode
        self.num_conf = num_conf
        self.t = 1 # クリック回数=1（デフォルト値）

    def locate (self) :

        region = self.region
        region = region[:4] # 4youso
        region = tuple(map(int, region)) # np.int64形式なので変換。
        print('region----------',region)
        btn = self.btn

        base_dir = os.path.join("C:/Users", os.getlogin(), "aircon", "btn")
        img = pg.screenshot(os.path.join(base_dir, btn + '_screenshot.png'), region= region)        
        # img = pg.screenshot('C:/Users/hp/aircon/btn/verification/'+ btn + '_screenshot.png', region= region)
        

        if img is not None:
            print("スクリーンショットが正常に取得されました。")
        else:
            print("スクリーンショットが取得できませんでした。")

        self.img = img

    def calc (self) :
        pass

    def optimization (self) : 
        
        pass       
        
    def setting (self) :

        btn = self.btn

        # OCRエンジンを取得
        tools = pyocr.get_available_tools()
        # if len(tools) == 0:
            # print("OCR tool not found")
            # exit(1)
        tool = tools[0]

        # 画像を開く
        base_dir = os.path.join("C:/Users", os.getlogin(), "aircon", "btn", "verification")
        image = Image.open(os.path.join(base_dir, btn + '_screenshot.png'))
        # image = Image.open('C:/Users/hp/aircon/btn/verification/' + btn + '_screenshot.png')

        # builder変数を定義。
        pyocr.tesseract.TESSERACT_CMD = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        builder = pyocr.builders.TextBuilder(tesseract_layout=6)

        # 画像からテキストを抽出。日本語の設定を追加
        txt = tool.image_to_string(image, lang='jpn', builder=builder)
        txt = txt.replace(' ', '')
        print('認識できた文字=', txt)
        
        self.value = txt # Autoのreturn文で返す値


class AutoTextFloat(AutoText):

    def setting (self) :

        settting_val = self.settting_val
        # value = '{:.1f}'.format(settting_val)
        value = '{:.1f}'.format(float(settting_val))
        pyperclip.copy(value)
        pg.hotkey('ctrl', 'v')

        self.value = settting_val # Autoのreturn文で返す値。


class AutoTextStr(AutoText):

    def setting (self) :
        
        time.sleep(0.3) # 外側から変えられるようにするか要検討。
        settting_val = self.settting_val
        print('★settting_val=',settting_val)
        pyperclip.copy(settting_val)
        pg.hotkey('ctrl', 'v')

        self.value = settting_val # Autoのreturn文で返す値。


# サブクラス（４階層目）

class AutoImageClickMulti(AutoImageClick):

    def __init__(self, btn, df_region, current_val, settting_val, mode, num_conf) :

        self.btn = btn
        self.df_region = df_region
        self.mode = mode
        self.num_conf = num_conf
        
        self.current_val = current_val # 現在の値。
        self.settting_val = settting_val # 設定値。

    def calc (self) :

        # num = self.num
        cycle = self.cycle
        current_val = self.current_val
        settting_val = self.settting_val

        t = settting_val - current_val
        if t < 0 : # 大小関係が逆転している場合は、settting_valにcycleを足す。
            t = (settting_val + cycle ) - current_val
        
        print('クリック回数:', t)

        self.t = t

class AutoImageClickDouble(AutoImageClick):

    def __init__(self, btn, df_region, mode, num_conf) :

        self.btn = btn
        self.df_region = df_region
        self.mode = mode
        self.num_conf = num_conf
        self.t = 2 # クリック回数=1（デフォルト値）

    def calc (self) :
        pass

    def setting (self) :

        locate = self.locate
        print('★settinglocate=',locate)
        t = self.t
        i = 0.1
        x, y = pg.center(locate)
        pg.click(x, y, clicks = t, interval = i)


def initialize_model():
    X = [
        [600, 2.5, 12, 180, 45, 18],
        [1200, 1.0, 4, 100, 50, 50],
        [200, 1.2, 8, 190, 30, 20],
        [6000, 0.8, 6, 90, 200, 150],
        [100, 0.2, 10, 50, 10, 5]
    ]
    y = [1, 2, 1, 2, 0]
    clf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    clf_model.fit(X, y)
    return clf_model

def extract_features(image, contour):
    x, y, w, h = cv2.boundingRect(contour)
    aspect_ratio = w / float(h)
    area = cv2.contourArea(contour)
    perimeter = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
    corners = len(approx)
    roi = image[y:y+h, x:x+w]
    mean_gray = cv2.mean(cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY))[0]
    return [area, aspect_ratio, corners, mean_gray, w, h]

def load_name_options_from_csv(filename="region.csv"):
    options = []
    try:
        with open(filename, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                btn_name = row.get("btn", "").strip()
                if btn_name:
                    options.append(btn_name)
    except Exception as e:
        print(f"CSV読み込みエラー: {e}")
        messagebox.showerror("CSV読み込み失敗", f"{filename} の読み込みに失敗しました。")
    return options


def show_name_selection_popup(name_options, on_select_callback):
    popup = tk.Toplevel()
    popup.title("保存名を選択")
    popup.geometry("350x350")
    popup.configure(bg="white")

    label = tk.Label(popup, text="保存名を選択:", bg="white")
    label.pack(pady=10)

    frame = tk.Frame(popup, bg="white")
    frame.pack(pady=10, fill="both", expand=True)

    scrollbar = tk.Scrollbar(frame)
    scrollbar.pack(side="right", fill="y", padx=(5, 0))

    listbox = tk.Listbox(frame, height=10, font=("Arial", 10), yscrollcommand=scrollbar.set)
    for name in name_options:
        listbox.insert(tk.END, name)
    listbox.pack(side="left", fill="both", expand=True)
    scrollbar.config(command=listbox.yview)

    def on_confirm():
        selected = listbox.curselection()
        if not selected:
            messagebox.showwarning("未選択", "保存名を選択してください。")
            return
        selected_name = listbox.get(selected[0])
        on_select_callback(selected_name)
        popup.destroy()

    confirm_button = tk.Button(popup, text="OK", command=on_confirm)
    confirm_button.pack(pady=10)



def on_select(index, label_widget):
    global selected_label, selected_index
    if selected_label is not None:
        selected_label.config(highlightthickness=0)
    label_widget.config(highlightthickness=2, highlightbackground="blue")
    selected_label = label_widget
    selected_index = index
    print(f"選択されたボタン: {index + 1}")



def save_selected_button(image_info):
    global selected_index
    if selected_index is None:
        messagebox.showwarning("選択なし", "保存する画像を選択してください。")
        return

    # image_info から座標情報も取得
    # img_array, _, x, y, w, h = image_info[selected_index]
    # img_array, _ = image_info[selected_index]
    img_array, _, (cx, cy, btn_w, btn_h) = image_info[selected_index]

    name_options = load_name_options_from_csv()

    popup = tk.Toplevel(root)
    popup.title("保存名を選択")
    popup.geometry("350x350")
    popup.configure(bg="white")

    label = tk.Label(popup, text="保存名を選択:", bg="white")
    label.pack(pady=10)

    frame = tk.Frame(popup, bg="white")
    frame.pack(pady=10, fill="both", expand=True)

    scrollbar = tk.Scrollbar(frame)
    scrollbar.pack(side="right", fill="y", padx=(5, 0))

    listbox = tk.Listbox(frame, height=10, font=("Arial", 10), yscrollcommand=scrollbar.set)
    for name in name_options:
        listbox.insert(tk.END, name)
    listbox.pack(side="left", fill="both", expand=True)
    scrollbar.config(command=listbox.yview)

    def confirm_selection():
        selected = listbox.curselection()
        if not selected:
            messagebox.showwarning("未選択", "名前を選択してください。")
            return

        filename = name_options[selected[0]]
        save_dir = "btn"
        os.makedirs(save_dir, exist_ok=True)

        # 画像保存
        save_path = os.path.join(save_dir, f"{filename}.png")
        cv2.imwrite(save_path, img_array)

        # 絶対座標の中心点を計算
        # cx_absolute = x + w // 2
        # cy_absolute = y + h // 2

        # region.csv の読み込みと更新
        try:
            df_region = pd.read_csv("region.csv", encoding="shift jis")
            if "btn" in df_region.columns:
                target_idx = df_region[df_region["btn"] == filename].index
                if not target_idx.empty:
                    df_region.loc[target_idx, "cx"] = cx
                    df_region.loc[target_idx, "cy"] = cy
                    df_region.loc[target_idx, "w"] = btn_w
                    df_region.loc[target_idx, "h"] = btn_h
                    df_region.to_csv("region.csv", index=False, encoding="shift jis")
                    messagebox.showinfo("保存完了", f"画像と座標を保存しました：\n{save_path}\nregion.csv に cx, cy を更新しました。")
                else:
                    messagebox.showwarning("未登録", f"region.csv に {filename} が見つかりません。")
            else:
                messagebox.showerror("CSVエラー", "region.csv に 'btn' 列が存在しません。")
        except Exception as e:
            messagebox.showerror("CSV読み込み失敗", f"region.csv の読み込みに失敗しました。\n{e}")

        popup.destroy()

    confirm_btn = tk.Button(popup, text="保存", command=confirm_selection, bg="#4CAF50", fg="white")
    confirm_btn.pack(pady=10)




def insert_result_into_main_window(parent_frame, image_info, output_text):
    global selected_label, selected_index
    selected_label = None
    selected_index = None

    # 既存のウィジェットをクリア
    for widget in parent_frame.winfo_children():
        widget.destroy()

    # 結果テキスト表示
    result_label = tk.Label(parent_frame, text=output_text, justify="left", bg="white", fg="black", font=("Arial", 10))
    result_label.pack(pady=10)

    # ボタン画像とラベルの表示
    # for i, (img_array, label_text, x, y, w, h) in enumerate(image_info):
    for i, (img_array, label_text, center) in enumerate(image_info):

        cx, cy, btn_w, btn_h = center  # 座標を取り出す
        h, w = img_array.shape[:2]  # 高さと幅を取得。:2は２つの要素を取り出すという意味。
        
        img_rgb = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(img_rgb).resize((100, 100))
        tk_img = ImageTk.PhotoImage(img_pil)

        row_frame = tk.Frame(parent_frame, bg="white")
        row_frame.pack(pady=5)

        label_img = tk.Label(row_frame, image=tk_img, bg="white", highlightthickness=0)
        label_img.image = tk_img  # 参照保持
        label_img.pack(side="left", padx=10)
        label_img.bind("<Button-1>", lambda e, idx=i, widget=label_img: on_select(idx, widget))

        # label_txt = tk.Label(row_frame, text=f"ボタン {i+1}: {label_text}", bg="white", fg="black", font=("Arial", 9))
        label_txt = tk.Label(
        row_frame,
        # text=f"ボタン {i+1}: {label_text}\n中心座標: ({cx}, {cy})",
        text=f"ボタン {i+1}: \n中心座標: ({cx}, {cy}, {btn_w}, {btn_h})",
        bg="white", fg="black", font=("Arial", 9), justify="left"
        )
        label_txt.pack(side="left", padx=10)

    # 保存ボタン
    save_btn = tk.Button(parent_frame, text="保存", bg="#4CAF50", fg="white", font=("Arial", 10),
                         command=lambda: save_selected_button(image_info))
    save_btn.pack(pady=20)



def detect_buttons(region):
    global clf
    screenshot = pg.screenshot(region=region)
    screenshot_np = np.array(screenshot)

    if screenshot_np is None or screenshot_np.size == 0:
        messagebox.showerror("スクリーンショットエラー", "スクリーンショットの取得に失敗しました。領域を再選択してください。")
        return

    screenshot_bgr = cv2.cvtColor(screenshot_np, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(screenshot_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blurred, 20, 100)
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    button_candidates = []
    image_info = []
    output_text = ""

    for cnt in contours:
        features = extract_features(screenshot_bgr, cnt)
        area, aspect_ratio, corners, mean_gray, w, h = features
        if w < 15 or h < 15 or area < 100:
            continue
        prediction = clf.predict([features])[0]
        if prediction in [1, 2]:
            x, y, w, h = cv2.boundingRect(cnt)
            button_img = screenshot_bgr[y:y+h, x:x+w]
            label_text = "文字ボタン" if prediction == 1 else "絵ボタン"
            # image_info.append((button_img, label_text))

            # cx = x + w // 2
            # cy = y + h // 2
            cx = x + w // 2 + region[0]
            cy = y + h // 2 + region[1]
            btn_x = region[0] + x
            btn_y = region[1] + y
            btn_w = w
            btn_h = h

            # 順序入れ替え。
            image_info.append((button_img, label_text, (cx, cy, btn_w, btn_h)))  
            button_candidates.append((x, y, w, h)) # ボックス表示の情報など。

            # output_text += f"ボタン {len(button_candidates)} ({label_text}) の中心座標: ({cx}, {cy})\n"

    messagebox.showinfo('検出完了', f"{len(button_candidates)} 個のボタンが検出されました。")
    insert_result_into_main_window(content_frame, image_info, output_text)


def get_region_by_drag(callback):
    messagebox.showinfo('メッセージ', '範囲を指定して下さい。')

    drag_win = tk.Toplevel()
    drag_win.attributes("-fullscreen", True)
    drag_win.attributes("-alpha", 0.3)
    drag_win.configure(bg="black")
    drag_win.title("領域選択")

    canvas = tk.Canvas(drag_win, cursor="cross", bg="black")
    canvas.pack(fill="both", expand=True)

    start_x = start_y = end_x = end_y = 0
    rect_id = None

    def on_button_press(event):
        nonlocal start_x, start_y, rect_id
        start_x, start_y = event.x, event.y
        rect_id = canvas.create_rectangle(start_x, start_y, start_x, start_y, outline="red", width=2)

    def on_move(event):
        canvas.coords(rect_id, start_x, start_y, event.x, event.y)

    def on_release(event):
        nonlocal end_x, end_y
        end_x, end_y = event.x, event.y
        drag_win.destroy()
        region = [min(start_x, end_x), min(start_y, end_y), abs(end_x - start_x), abs(end_y - start_y)]
        callback(region)

    canvas.bind("<ButtonPress-1>", on_button_press)
    canvas.bind("<B1-Motion>", on_move)
    canvas.bind("<ButtonRelease-1>", on_release)

    drag_win.grab_set()
    drag_win.wait_window()

    # messagebox.showinfo('メッセージ', '座標を取得しました。')


def run_detection():
    get_region_by_drag(detect_buttons)


        

if __name__ == '__main__':
    main()
