FROM golang:1.27.2-alpine AS build
ARG VERSION=unreleased
ARG COMMIT_SHA=unknown
WORKDIR /src
COPY pkg/go.mod pkg/go.sum ./pkg/
COPY contracts/gen/game/go.mod contracts/gen/game/go.sum ./contracts/gen/game/
COPY services/game/go.mod services/game/go.sum ./services/game/
WORKDIR /src/services/game
RUN go mod download
COPY pkg/ /src/pkg/
COPY contracts/gen/game/ /src/contracts/gen/game/
COPY services/game/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X drop2empire/pkg/httpx.BuildVersion=$VERSION -X drop2empire/pkg/httpx.BuildSHA=$COMMIT_SHA" -o /out/service ./cmd

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && addgroup -S drop2empire && adduser -S -G drop2empire drop2empire
WORKDIR /app
COPY --from=build /out/ /app/
USER drop2empire
ENTRYPOINT ["/app/service"]
