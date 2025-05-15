import React from "react";
import TaskItem from "./TaskItem";

const TaskList = ({ tasks, toggleTask, deleteTask }) => {
  return (
    <ul className="task-list">
      {tasks.map((task, index) => (
        <TaskItem key={index} task={task} index={index} toggleTask={toggleTask} deleteTask={deleteTask} />
      ))}
    </ul>
  );
};

export default TaskList;
