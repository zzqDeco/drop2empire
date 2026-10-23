// Package observability provides structured boundary logging and HTTP request correlation.
package observability

import (
	"log/slog"
	"net/http"
	"os"
	"time"
)

var logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
	Level: slog.LevelInfo,
}))

type statusRecorder struct {
	http.ResponseWriter
	status int
	err    error
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// RecordError attaches an error to the response writer for boundary logging.
func RecordError(w http.ResponseWriter, err error) {
	if rec, ok := w.(*statusRecorder); ok {
		rec.err = err
	}
}

// HTTP wraps an http.Handler with structured boundary completion logs.
func HTTP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		durNs := time.Since(start).Nanoseconds()
		if rec.err != nil {
			logger.Warn("http.request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"duration_ns", durNs,
				"error", rec.err.Error(),
			)
			return
		}
		logger.Info("http.request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ns", durNs,
		)
	})
}
