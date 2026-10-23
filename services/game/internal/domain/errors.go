package domain

import "net/http"

// Error represents a domain rule violation carrying a safe HTTP status code and machine-readable code.
type Error struct {
	Status  int
	Code    string
	Message string
}

func (e *Error) Error() string      { return e.Message }
func (e *Error) StatusCode() int    { return e.Status }
func (e *Error) ErrorCode() string  { return e.Code }

func ErrInvalidInput(msg string) error {
	return &Error{Status: http.StatusBadRequest, Code: "invalid_input", Message: msg}
}

func ErrPrecondition(code, msg string) error {
	return &Error{Status: http.StatusUnprocessableEntity, Code: code, Message: msg}
}

func ErrNotFound(msg string) error {
	return &Error{Status: http.StatusNotFound, Code: "not_found", Message: msg}
}
