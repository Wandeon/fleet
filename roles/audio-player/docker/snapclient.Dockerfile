FROM debian:bookworm-slim

# Install Snapcast client and ALSA utilities
RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y \
        snapclient \
        alsa-utils \
        procps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add audio user/group support
RUN groupadd -r audio || true

# Expose Snapcast client port (optional)
EXPOSE 1704

# Default command will be overridden by docker-compose
CMD ["snapclient"]
