import React from 'react';
import Link from 'next/link';

const Sidebar = () => {
  return (
    <div style={{ width: '200px', background: '#f4f4f4', padding: '20px' }}>
      <h2>Sidebar</h2>
      <ul>

        <li><Link href="/">Home</Link></li>
        <li><Link href="/ListIot">ListIot</Link></li>

      </ul>
    </div>
  );
};

export default Sidebar;