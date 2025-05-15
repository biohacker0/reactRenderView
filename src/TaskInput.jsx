import React from "react";

const TaskInput = ({ input, setInput, addTask }) => {
  return (
    <div className="input-container">
      <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a new task" />
      <button onClick={addTask}>Add</button>
    </div>
  );
};

export default TaskInput;
