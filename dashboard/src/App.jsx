import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="rounded-lg bg-white p-8 shadow-lg text-center">
              <h1 className="text-4xl font-bold text-blue-600 mb-4">
                Dashboard Scaffold Successful!
              </h1>
              <p className="text-gray-700 font-medium">
                React + Vite + Tailwind + React Router are all working.
              </p>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;