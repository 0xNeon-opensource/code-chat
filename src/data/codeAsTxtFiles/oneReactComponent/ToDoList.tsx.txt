import React, { useState } from 'react';

interface TodoItem {
    id: number;
    text: string;
    completed: boolean;
}

const TodoList: React.FC = () => {
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [inputText, setInputText] = useState('');

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(event.target.value);
    };

    const handleAddTodo = () => {
        if (inputText.trim() !== '') {
            const newTodo: TodoItem = {
                id: Date.now(),
                text: inputText,
                completed: false,
            };
            setTodos([...todos, newTodo]);
            setInputText('');
        }
    };

    const handleToggleComplete = (id: number) => {
        setTodos(prevTodos =>
            prevTodos.map(todo =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
        );
    };

    const handleRemoveTodo = (id: number) => {
        setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
    };

    return (
        <div>
            <input type="text" value={inputText} onChange={handleInputChange} />
            <button onClick={handleAddTodo}>Add</button>
            <ul>
                {todos.map(todo => (
                    <li key={todo.id}>
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => handleToggleComplete(todo.id)}
                        />
                        <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                            {todo.text}
                        </span>
                        <button onClick={() => handleRemoveTodo(todo.id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TodoList;
