FROM arm32v7/alpine:3.19

RUN apk add --no-cache icecast

# Create directories and set ownership (icecast user created by package)
RUN mkdir -p /etc/icecast2 /var/log/icecast && \
    chown -R icecast:icecast /etc/icecast2 /var/log/icecast /usr/share/icecast

# Copy default config
COPY icecast-template.xml /etc/icecast2/icecast.xml
RUN chown icecast:icecast /etc/icecast2/icecast.xml

# Switch to icecast user
USER icecast

# Expose the icecast port
EXPOSE 8000

# Run icecast
CMD ["icecast", "-c", "/etc/icecast2/icecast.xml"]
