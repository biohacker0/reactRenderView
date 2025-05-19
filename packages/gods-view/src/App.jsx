import { useEffect, useState } from "react";

function App() {
  const [renderData, setRenderData] = useState([]);
  const [componentTree, setComponentTree] = useState(null);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (event.origin !== "http://localhost:3000") return; // Security check
      if (event.data.type === "RENDER_DATA") {
        const { renderData: newRenderData, componentTree: newComponentTree } = event.data.payload;
        setRenderData(newRenderData);
        setComponentTree(newComponentTree);
        console.log("God's View: Received data", newRenderData, newComponentTree);
      }
    });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>God’s View</h1>
      <p>Check the console for received data.</p>
      <pre style={{ background: "#f0f0f0", padding: "10px", maxHeight: "500px", overflow: "auto" }}>{JSON.stringify({ renderData, componentTree }, null, 2)}</pre>
    </div>
  );
}

export default App;
