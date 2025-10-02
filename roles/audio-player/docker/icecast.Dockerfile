FROM arm32v7/alpine:3.19

RUN apk add --no-cache icecast

# Create config directory
RUN mkdir -p /etc/icecast2

# Copy default config and allow environment variable substitution
COPY icecast-template.xml /etc/icecast2/icecast.xml

# Expose the icecast port
EXPOSE 8000

# Run icecast
CMD ["icecast", "-c", "/etc/icecast2/icecast.xml"]
