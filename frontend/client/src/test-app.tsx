import React from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from '@/components/Layout';

function TestApp() {
  return (
    <Layout title="Test">
      <div>
        <h1>Test App</h1>
        <p>If you can see this, React is working.</p>
      </div>
    </Layout>
  );
}

createRoot(document.getElementById('root')).render(<TestApp />);
