package main

import (
	"fmt"
	"log"
	"strings"

	"gitboard/internal/db"
)

// ListTodos returns all todo items for a project.
func (a *App) ListTodos(projectID int64) []db.Todo {
	todos, err := a.Stores.Todo.List(projectID)
	if err != nil {
		log.Printf("list todos error: %v", err)
		return nil
	}
	if todos == nil {
		todos = []db.Todo{}
	}
	return todos
}

// CreateTodo creates a new todo for a project.
func (a *App) CreateTodo(projectID int64, title string) (*db.Todo, error) {
	if strings.TrimSpace(title) == "" {
		return nil, fmt.Errorf("title is required")
	}
	return a.Stores.Todo.Create(projectID, title)
}

// ToggleTodo flips the completed status of a todo.
func (a *App) ToggleTodo(todoID int64) error {
	return a.Stores.Todo.Toggle(todoID)
}

// DeleteTodo removes a todo.
func (a *App) DeleteTodo(todoID int64) error {
	return a.Stores.Todo.Delete(todoID)
}

// ReorderTodos updates the sort_order for a list of todo IDs.
func (a *App) ReorderTodos(todoIDs []int64) error {
	return a.Stores.Todo.Reorder(todoIDs)
}
