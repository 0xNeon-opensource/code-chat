interface Todo {
    id: number;
    task: string;
    completed: boolean;
}

class TodoList {
    private todos: Todo[];

    constructor() {
        this.todos = [];
    }

    addTodo(task: string): void {
        const newTodo: Todo = {
            id: this.todos.length + 1,
            task,
            completed: false,
        };
        this.todos.push(newTodo);
    }

    completeTodoById(id: number): void {
        const todo = this.todos.find((todo) => todo.id === id);
        if (todo) {
            todo.completed = true;
        }
    }

    deleteTodoById(id: number): void {
        this.todos = this.todos.filter((todo) => todo.id !== id);
    }

    getTodos(): Todo[] {
        return this.todos;
    }
}

// Usage example
const todoList = new TodoList();

todoList.addTodo("Buy groceries");
todoList.addTodo("Finish coding assignment");
todoList.addTodo("Go for a run");

console.log(todoList.getTodos());

todoList.completeTodoById(2);
console.log(todoList.getTodos());

todoList.deleteTodoById(1);
console.log(todoList.getTodos());
