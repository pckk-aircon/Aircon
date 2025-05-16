"use client";
import Link from 'next/link';
//import styles from './sidebar.module.css'; // サイドバー用のCSSモジュールを作成してください。

export default function Sidebar() {
  return (
    <div>
      <h2>メニュー</h2>
      <ul>
        <li><Link href="/">トップ画面</Link></li>
        <li><Link href="/ListIot">ListIot</Link></li>
        <li><Link href="/TableDivision">TableDivision</Link></li>
        <li><Link href="/TableDevice">TableDevice</Link></li>
      </ul>
    </div>
  );
}