import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return <main className="foundation"><p className="tag tag-accent-2">Foundation build</p>
    <h1>Freedom Capital</h1><p>Lifetime capital allocation and financial independence modelling.</p>
    <section className="card"><h2>Model implementation in progress</h2>
      <p>The shared financial contracts and tax engine are the first delivery. The dashboard and simulation screens follow in later chunks.</p>
    </section></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
