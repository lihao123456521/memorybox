import ReactDOM from 'react-dom/client';
import App from './App';
import {setupPortableAssets} from './portableAssets';
import './styles.css';
setupPortableAssets();
ReactDOM.createRoot(document.getElementById('root')!).render(<App/>);
