import { BrowserRouter, Routes, Route } from "react-router";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { About } from "./pages/About";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/about"
          element={
            <>
              <Header title="notifoo" enableBack />
              <About />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
