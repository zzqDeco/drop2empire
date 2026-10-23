package httpx

import (
	"net/http"
	"time"

	"drop2empire/pkg/observability"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/adaptor"
)

// Serve starts a CloudWeGo Hertz HTTP server wrapping handler with structured observability.
func Serve(addr string, handler http.Handler) {
	h := server.Default(
		server.WithHostPorts(addr),
		server.WithMaxRequestBodySize(131072),
		server.WithStreamBody(true),
		server.WithReadTimeout(15*time.Second),
		server.WithWriteTimeout(30*time.Second),
	)
	h.Any("/*path", adaptor.HertzHandler(observability.HTTP(handler)))
	h.Spin()
}
