# Use a lightweight production-grade server
FROM nginx:alpine

# Create a simple, informative landing page
RUN echo '<!DOCTYPE html>\
<html>\
<head>\
    <title>PetChain Frontend - Development Mode</title>\
    <style>\
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; \
               display: flex; justify-content: center; align-items: center; height: 100vh; \
               margin: 0; background-color: #f3f4f6; }\
        .container { background: white; padding: 2.5rem; border-radius: 12px; \
                     box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; }\
        h1 { color: #111827; margin-bottom: 0.5rem; }\
        p { color: #4b5563; line-height: 1.5; }\
        .status-badge { display: inline-block; padding: 0.25rem 0.75rem; background: #dcfce7; \
                        color: #166534; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; }\
    </style>\
</head>\
<body>\
    <div class="container">\
        <div class="status-badge">Container Active</div>\
        <h1>PetChain Frontend</h1>\
        <p>The frontend infrastructure is successfully orchestrated.</p>\
        <p><strong>Note:</strong> This is a skeleton view because the Next.js build is currently failing due to dependency and syntax errors.</p>\
    </div>\
</body>\
</html>' > /usr/share/nginx/html/index.html

# Configure Nginx to listen on port 3000 to match your current Compose setup
RUN sed -i 's/listen       80;/listen       3000;/g' /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
