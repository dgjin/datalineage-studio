#!/bin/bash
# DataLineage Studio Backend Startup Script

echo "=========================================="
echo "  DataLineage Studio Backend"
echo "=========================================="

# Check if MySQL is running
if ! nc -z localhost 3306 2>/dev/null; then
    echo "[WARN] MySQL is not running on localhost:3306"
    echo "       Please start MySQL first or use docker-compose"
    echo ""
    echo "       docker-compose up -d mysql"
    echo ""
fi

# Build if needed
if [ "$1" == "--build" ] || [ ! -f "target/datalineage-backend-1.0.0.jar" ]; then
    echo "[INFO] Building backend..."
    mvn clean package -DskipTests
fi

# Run
echo "[INFO] Starting DataLineage Backend..."
echo "[INFO] API will be available at: http://localhost:8080/api/v1"
echo "[INFO] Swagger UI: http://localhost:8080/api/v1/swagger-ui.html"
echo ""

mvn spring-boot:run
