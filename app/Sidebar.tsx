/*
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
        <li><Link href="/Map">Map</Link></li>
      </ul>
    </div>
  );
}
*/


"use client";
import Link from 'next/link';
import { useController } from "@/app/context/ControllerContext";

export default function Sidebar() {
  const { controller, setController } = useController();

  const handleControllerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setController(e.target.value);
    console.log("選択された拠点:", e.target.value);
  };

  return (
    <div>
      <h2>拠点選択</h2>
      <select value={controller} onChange={handleControllerChange}>
        <option value="Mutsu01">むつざわ</option>
        <option value="Koura01">こうら</option>
      </select>

      <h2>メニュー</h2>
      <ul>
        <li><Link href="/">トップ画面</Link></li>
        <li><Link href="/ListIot">ListIot</Link></li>
        <li><Link href="/TableDivision">TableDivision</Link></li>
        <li><Link href="/TableDevice">TableDevice</Link></li>
        <li><Link href="/Map">Map</Link></li>
      </ul>
    </div>
  );
}
