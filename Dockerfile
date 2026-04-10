# Use the official Nginx image as a base
FROM nginx:alpine

# Copy your website files into the Nginx public directory
# The `.` refers to the current directory where the Dockerfile is located
# /usr/share/nginx/html is the default Nginx web root
COPY . /usr/share/nginx/html

# Expose port 80, which Nginx listens on by default
EXPOSE 80

# The default Nginx command will run, serving your website
CMD ["nginx", "-g", "daemon off;"]