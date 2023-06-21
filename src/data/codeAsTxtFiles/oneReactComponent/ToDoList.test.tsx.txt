import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import TodoList from './ToDoList';

test('renders the todo list component', () => {
    const { getByText, getByLabelText } = render(<TodoList />);

    // Assert that the component renders correctly
    const headingElement = getByText(/To-Do List/i);
    expect(headingElement).toBeInTheDocument();

    // Test adding a new todo
    const inputElement = getByLabelText('Todo Input');
    const addButtonElement = getByText(/Add/i);

    fireEvent.change(inputElement, { target: { value: 'New task' } });
    fireEvent.click(addButtonElement);

    const newTaskElement = getByText(/New task/i);
    expect(newTaskElement).toBeInTheDocument();

    // Test marking a todo as completed
    const checkboxElement = getByLabelText(/New task/i);
    fireEvent.click(checkboxElement);

    expect(checkboxElement.checked).toBe(true);
    expect(newTaskElement).toHaveStyle('text-decoration: line-through');

    // Test removing a todo
    const removeButtonElement = getByText(/Remove/i);
    fireEvent.click(removeButtonElement);

    expect(newTaskElement).not.toBeInTheDocument();
});
