// Package httpx provides shared HTTP transport helpers, strict JSON decoding,
// session cookie handling, Hertz server bootstrap, and domain-error-to-HTTP-response mapping.
package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"drop2empire/pkg/observability"
)

const CookieName = "d2e_handle"

var BuildVersion = "0.1.0"
var BuildSHA = "dev"

// CodedError is implemented by domain and transport errors that carry a safe
// HTTP status code and machine-readable error code via Go structural typing.
type CodedError interface {
	error
	StatusCode() int
	ErrorCode() string
}

// Error represents a transport or domain error with an HTTP status code, machine-readable code, and safe message.
type Error struct {
	Status        int
	Code, Message string
	Cause         error
}

func (e *Error) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}
func (e *Error) StatusCode() int   { return e.Status }
func (e *Error) ErrorCode() string { return e.Code }
func (e *Error) Unwrap() error     { return e.Cause }

// Err constructs an Error with the given HTTP status, code, and safe message.
func Err(status int, code, message string) error {
	return &Error{Status: status, Code: code, Message: message}
}

// Responder maps application/domain results and CodedErrors onto HTTP handlers.
type Responder struct{}

// DecodeRequest decodes a JSON request body using strict JSON validation.
func (Responder) DecodeRequest(w http.ResponseWriter, r *http.Request, dst any) error {
	return DecodeJSON(w, r, dst)
}

// WriteBindErrorHTTP writes a 400 invalid_request JSON response to w.
func (Responder) WriteBindErrorHTTP(w http.ResponseWriter, _ *http.Request, err error) {
	WriteError(w, err)
}

// WriteDomainErrorHTTP writes a CodedError or generic 500 internal_error JSON response to w.
func (Responder) WriteDomainErrorHTTP(w http.ResponseWriter, _ *http.Request, err error) {
	WriteError(w, err)
}

// WriteOKHTTP writes a JSON response with status to w.
func (Responder) WriteOKHTTP(w http.ResponseWriter, _ *http.Request, status int, resp any) {
	WriteJSON(w, status, resp)
}

// WriteJSON serializes value as application/json with the given HTTP status code.
func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if value != nil {
		_ = json.NewEncoder(w).Encode(value)
	}
}

// WriteError records the error for observability and writes a safe JSON error response.
func WriteError(w http.ResponseWriter, err error) {
	observability.RecordError(w, err)
	var ae *Error
	if errors.As(err, &ae) {
		WriteJSON(w, ae.Status, map[string]any{
			"error": map[string]string{
				"code":    ae.Code,
				"message": ae.Message,
			},
		})
		return
	}
	var coded CodedError
	if errors.As(err, &coded) {
		WriteJSON(w, coded.StatusCode(), map[string]any{
			"error": map[string]string{
				"code":    coded.ErrorCode(),
				"message": coded.Error(),
			},
		})
		return
	}
	WriteJSON(w, http.StatusInternalServerError, map[string]any{
		"error": map[string]string{
			"code":    "internal_error",
			"message": "The request could not be completed",
		},
	})
}

// DecodeJSON strictly decodes a single JSON object of at most 128 KiB with no unknown fields.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	if r.Body == nil || r.ContentLength == 0 {
		return nil
	}
	r.Body = http.MaxBytesReader(w, r.Body, 131072)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return Err(http.StatusBadRequest, "invalid_request", "请求 JSON 格式无效")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return Err(http.StatusBadRequest, "invalid_request", "请求体仅允许单个 JSON 对象")
	}
	return nil
}

// ID generates a new random UUIDv4 string.
func ID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// RandomHex returns n cryptographically random bytes encoded as lowercase hex.
func RandomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// Env returns the environment variable k or fallback if unset/empty.
func Env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

// OperationsContext registers /healthz, /readyz, and /version on m.
func OperationsContext(m *http.ServeMux, ready func(context.Context) error) {
	m.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	m.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if ready != nil {
			if err := ready(ctx); err != nil {
				WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
				return
			}
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	m.HandleFunc("GET /version", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"version": BuildVersion, "sha": BuildSHA})
	})
}
