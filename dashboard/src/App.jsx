import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReportsTable from './components/ReportsTable.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReportsTable />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;