import React from "react";

const TaskItem = ({ task, index, toggleTask, deleteTask }) => {
  return (
    <li className={task.completed ? "task completed" : "task"}>
      <span onClick={() => toggleTask(index)}>{task.text}</span>
      <button onClick={() => deleteTask(index)}>Delete</button>
    </li>
  );
};

export default TaskItem;
