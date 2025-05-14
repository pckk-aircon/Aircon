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
        <li><Link href="/ListIot2">ListIot2</Link></li>
        <li><Link href="/TableDivision">TableDivision</Link></li>
        <li><Link href="/TableDevice">TableDevice</Link></li>
        <li><Link href="/Map">Map</Link></li>
        <li><Link href="/Map2">Map2</Link></li>
        <li><Link href="/Map3">Map3</Link></li>
      </ul>
    </div>
  );
}