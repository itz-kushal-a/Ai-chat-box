import { useEffect, useState } from 'react';
import { capitalize } from 'shared';

export default function App() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/hello`)
      .then((r) => r.json())
      .then((d) => setMsg(d.data.message));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>{capitalize('frontend app')}</h1>
      <p>API says: {msg}</p>
    </div>
  );
}
