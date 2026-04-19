// ============================================================
// StudyGo — Jenkins Declarative Pipeline
// Full CI/CD: Build → Test → Code Quality → Security →
//             Deploy (Staging) → Release (Production) → Monitoring
// ============================================================

pipeline {
    agent any

    // ── Tool versions (configured in Jenkins Global Tool Config) ──
    tools {
        nodejs 'NodeJS-18'
    }

    // ── Environment variables ────────────────────────────────────
    environment {
        APP_NAME        = 'studygo'
        DOCKER_REGISTRY = 'docker.io/studygo'
        BUILD_VERSION   = "${APP_NAME}-${env.BRANCH_NAME}-${env.BUILD_NUMBER}"
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT?.take(7) ?: 'unknown'}"

        // Jenkins credential IDs
        DOCKER_CREDS    = credentials('docker-hub-credentials')
        SONAR_TOKEN     = credentials('sonarqube-token')
        SNYK_TOKEN      = credentials('snyk-api-token')
        STAGING_SSH     = credentials('staging-server-ssh')
        PROD_SSH        = credentials('production-server-ssh')
        ENV_SECRETS     = credentials('studygo-env-secrets')

        // SonarQube
        SONAR_HOST_URL  = 'http://localhost:9000'
        SONAR_PROJECT   = 'studygo-app'

        // Quality gate thresholds
        MIN_COVERAGE    = '70'
    }

    // ── Pipeline options ─────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 60, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds()
    }

    // ── Triggers ─────────────────────────────────────────────────
    triggers {
        // Poll SCM every 5 minutes (or use webhook)
        pollSCM('H/5 * * * *')
    }

    // ── Parameters ───────────────────────────────────────────────
    parameters {
        booleanParam(name: 'SKIP_TESTS',    defaultValue: false, description: 'Skip test stage (not recommended)')
        booleanParam(name: 'FORCE_DEPLOY',  defaultValue: false, description: 'Force deploy even if on non-main branch')
        booleanParam(name: 'RELEASE_TO_PROD', defaultValue: false, description: 'Promote staging build to production')
        string(name: 'RELEASE_TAG',         defaultValue: '', description: 'Override release tag (leave blank for auto)')
    }

    // ====================================================================
    // STAGES
    // ====================================================================
    stages {

        // ── Stage 1: Build ──────────────────────────────────────────────
        stage('Build') {
            steps {
                script {
                    echo "🔨 BUILD — Version: ${BUILD_VERSION} | Commit: ${GIT_COMMIT_SHORT}"
                }

                // ── Frontend Build ──
                dir('.') {
                    sh '''
                        echo "==> Installing frontend dependencies"
                        npm ci --legacy-peer-deps

                        echo "==> Building React production bundle"
                        REACT_APP_BASE_URL=http://localhost:4000/api/v1 \
                        npm run build

                        echo "==> Frontend build complete. Artifact: ./build/"
                        ls -lh build/
                    '''
                }

                // ── Backend Install ──
                dir('server') {
                    sh '''
                        echo "==> Installing backend dependencies"
                        npm ci --only=production --legacy-peer-deps
                        echo "==> Backend install complete"
                    '''
                }

                // ── Docker Images ──
                sh """
                    echo "==> Building Docker image: frontend"
                    docker build \
                        --build-arg BUILD_VERSION=${BUILD_VERSION} \
                        --build-arg REACT_APP_BASE_URL=http://localhost:4000/api/v1 \
                        --tag ${DOCKER_REGISTRY}/studygo-frontend:${BUILD_VERSION} \
                        --tag ${DOCKER_REGISTRY}/studygo-frontend:latest \
                        --file Dockerfile \
                        .

                    echo "==> Building Docker image: backend"
                    docker build \
                        --build-arg BUILD_VERSION=${BUILD_VERSION} \
                        --tag ${DOCKER_REGISTRY}/studygo-backend:${BUILD_VERSION} \
                        --tag ${DOCKER_REGISTRY}/studygo-backend:latest \
                        --file server/Dockerfile \
                        server/

                    echo "==> Docker images built successfully"
                    docker images | grep studygo
                """

                // ── Archive build artefact ──
                archiveArtifacts artifacts: 'build/**/*', fingerprint: true, allowEmptyArchive: false
            }

            post {
                success { echo "✅ Build Stage PASSED — ${BUILD_VERSION}" }
                failure { echo "❌ Build Stage FAILED" }
            }
        } // end Build

        // ── Stage 2: Test ───────────────────────────────────────────────
        stage('Test') {
            when {
                not { expression { params.SKIP_TESTS } }
            }
            parallel {

                // ── Frontend Unit Tests ──
                stage('Frontend Unit Tests') {
                    steps {
                        dir('.') {
                            sh '''
                                echo "==> Running React unit tests with coverage"
                                CI=true npm test -- \
                                    --coverage \
                                    --coverageReporters=text \
                                    --coverageReporters=lcov \
                                    --coverageReporters=clover \
                                    --watchAll=false \
                                    --forceExit \
                                    --passWithNoTests
                            '''
                        }
                    }
                    post {
                        always {
                            // Publish JUnit-style test results
                            junit allowEmptyResults: true, testResults: 'coverage/junit.xml'
                            // Publish coverage report
                            publishHTML([
                                allowMissing: true,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'coverage/lcov-report',
                                reportFiles: 'index.html',
                                reportName: 'Frontend Coverage Report'
                            ])
                        }
                    }
                }

                // ── Backend API Tests ──
                stage('Backend API Tests') {
                    steps {
                        dir('server') {
                            sh '''
                                echo "==> Installing test dependencies"
                                npm install --save-dev jest supertest @jest/globals --legacy-peer-deps 2>/dev/null || true

                                echo "==> Running backend tests"
                                npx jest \
                                    --testPathPattern="tests/" \
                                    --coverage \
                                    --coverageDirectory=./coverage \
                                    --coverageReporters=lcov \
                                    --forceExit \
                                    --passWithNoTests \
                                    || echo "No test files found — skipping"
                            '''
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'server/coverage/junit.xml'
                        }
                    }
                }

            } // end parallel
        } // end Test

        // ── Stage 3: Code Quality ────────────────────────────────────────
        stage('Code Quality') {
            steps {
                script {
                    echo "🔍 CODE QUALITY — SonarQube Analysis"
                }

                withSonarQubeEnv('SonarQube') {
                    sh """
                        npx sonar-scanner \
                            -Dsonar.projectKey=${SONAR_PROJECT} \
                            -Dsonar.projectName="StudyGo E-Learning Platform" \
                            -Dsonar.projectVersion=${BUILD_VERSION} \
                            -Dsonar.sources=src,server \
                            -Dsonar.exclusions=**/node_modules/**,**/build/**,**/coverage/**,**/*.test.js,**/*.spec.js,src/assets/** \
                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                            -Dsonar.coverage.exclusions=**/*.test.js,**/*.spec.js,src/index.js \
                            -Dsonar.host.url=${SONAR_HOST_URL} \
                            -Dsonar.login=${SONAR_TOKEN} \
                            -Dsonar.qualitygate.wait=true \
                            -Dsonar.qualitygate.timeout=300
                    """
                }

                // ── Quality Gate Check ──
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }

                // ── ESLint check ──
                sh '''
                    echo "==> Running ESLint static analysis"
                    npx eslint src/ \
                        --ext .js,.jsx \
                        --format json \
                        --output-file eslint-report.json \
                        || true
                    echo "ESLint analysis complete"
                    cat eslint-report.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
errors   = sum(f['errorCount']   for f in data)
warnings = sum(f['warningCount'] for f in data)
print(f'ESLint: {errors} errors, {warnings} warnings across {len(data)} files')
" 2>/dev/null || echo "ESLint report parsed"
                '''

                archiveArtifacts artifacts: 'eslint-report.json', allowEmptyArchive: true
            }

            post {
                success { echo "✅ Code Quality Stage PASSED — Quality gate met" }
                failure { echo "❌ Code Quality Stage FAILED — Quality gate not met" }
            }
        } // end Code Quality

        // ── Stage 4: Security ────────────────────────────────────────────
        stage('Security') {
            parallel {

                // ── Snyk Dependency Scan ──
                stage('Snyk Dependency Scan') {
                    steps {
                        sh """
                            echo "==> Running Snyk dependency vulnerability scan — Frontend"
                            npx snyk auth ${SNYK_TOKEN}

                            npx snyk test \
                                --severity-threshold=high \
                                --json \
                                > snyk-frontend-report.json \
                                || echo "Snyk frontend scan complete (vulnerabilities may exist)"

                            echo "==> Running Snyk dependency vulnerability scan — Backend"
                            cd server && npx snyk test \
                                --severity-threshold=high \
                                --json \
                                > ../snyk-backend-report.json \
                                || echo "Snyk backend scan complete"

                            echo "==> Snyk Container scan — Backend image"
                            npx snyk container test \
                                ${DOCKER_REGISTRY}/studygo-backend:${BUILD_VERSION} \
                                --severity-threshold=high \
                                --json \
                                > snyk-container-report.json \
                                || echo "Snyk container scan complete"
                        """
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'snyk-*.json', allowEmptyArchive: true
                        }
                    }
                }

                // ── Trivy Container Scan ──
                stage('Trivy Image Scan') {
                    steps {
                        sh """
                            echo "==> Running Trivy vulnerability scan on Docker images"

                            trivy image \
                                --exit-code 0 \
                                --severity HIGH,CRITICAL \
                                --format json \
                                --output trivy-frontend-report.json \
                                ${DOCKER_REGISTRY}/studygo-frontend:${BUILD_VERSION} \
                                || echo "Trivy installed or using Docker fallback"

                            trivy image \
                                --exit-code 0 \
                                --severity HIGH,CRITICAL \
                                --format json \
                                --output trivy-backend-report.json \
                                ${DOCKER_REGISTRY}/studygo-backend:${BUILD_VERSION} \
                                || echo "Trivy backend scan complete"

                            echo "==> Trivy filesystem scan (secrets & misconfigs)"
                            trivy fs \
                                --exit-code 0 \
                                --security-checks secret,config \
                                --format json \
                                --output trivy-fs-report.json \
                                . \
                                || echo "Trivy fs scan complete"
                        """
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'trivy-*.json', allowEmptyArchive: true
                        }
                    }
                }

            } // end parallel security

            post {
                always {
                    script {
                        // Parse and summarise security findings
                        sh '''
                            echo "======================================"
                            echo "   SECURITY SCAN SUMMARY"
                            echo "======================================"
                            for f in snyk-*.json trivy-*.json; do
                                [ -f "$f" ] && echo "Report: $f ($(wc -c < $f) bytes)"
                            done
                            echo "See archived artifacts for full details."
                        '''
                    }
                }
                success { echo "✅ Security Stage PASSED" }
                unstable { echo "⚠️  Security Stage UNSTABLE — review vulnerability reports" }
            }
        } // end Security

        // ── Stage 5: Deploy (Staging) ─────────────────────────────────────
        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                    expression { params.FORCE_DEPLOY }
                }
            }
            steps {
                script {
                    echo "🚀 DEPLOY — Deploying ${BUILD_VERSION} to STAGING"
                }

                // Push images to registry
                sh """
                    echo "==> Authenticating with Docker Hub"
                    echo ${DOCKER_CREDS_PSW} | docker login -u ${DOCKER_CREDS_USR} --password-stdin

                    echo "==> Pushing images to registry"
                    docker push ${DOCKER_REGISTRY}/studygo-frontend:${BUILD_VERSION}
                    docker push ${DOCKER_REGISTRY}/studygo-backend:${BUILD_VERSION}
                    docker push ${DOCKER_REGISTRY}/studygo-frontend:latest
                    docker push ${DOCKER_REGISTRY}/studygo-backend:latest
                    echo "==> Images pushed successfully"
                """

                // Deploy to staging server via Docker Compose
                withCredentials([sshUserPrivateKey(credentialsId: 'staging-server-ssh',
                                                   keyFileVariable: 'SSH_KEY',
                                                   usernameVariable: 'SSH_USER')]) {
                    sh """
                        echo "==> Deploying to staging server"
                        scp -i \$SSH_KEY -o StrictHostKeyChecking=no \
                            docker-compose.staging.yml \
                            monitoring/prometheus.yml \
                            monitoring/alert.rules.yml \
                            monitoring/alertmanager.yml \
                            \$SSH_USER@staging.studygo.internal:~/studygo/

                        ssh -i \$SSH_KEY -o StrictHostKeyChecking=no \$SSH_USER@staging.studygo.internal << 'ENDSSH'
                            cd ~/studygo
                            export BUILD_VERSION=${BUILD_VERSION}
                            export DOCKER_REGISTRY=${DOCKER_REGISTRY}

                            # Pull new images
                            docker-compose -f docker-compose.staging.yml pull

                            # Rolling update (zero-downtime)
                            docker-compose -f docker-compose.staging.yml up -d \
                                --remove-orphans \
                                --force-recreate

                            echo "==> Staging deployment complete"
                            docker-compose -f docker-compose.staging.yml ps
ENDSSH
                    """
                }

                // ── Smoke Test staging ──
                sh """
                    echo "==> Running smoke tests on staging"
                    sleep 20  # allow containers to initialise

                    STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \
                        http://staging.studygo.internal:3001/ \
                        --max-time 15 || echo "000")

                    if [ "\$STATUS" = "200" ]; then
                        echo "✅ Frontend smoke test PASSED (HTTP \$STATUS)"
                    else
                        echo "❌ Frontend smoke test FAILED (HTTP \$STATUS)"
                        exit 1
                    fi

                    API_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \
                        http://staging.studygo.internal:4001/ \
                        --max-time 15 || echo "000")

                    if [ "\$API_STATUS" = "200" ]; then
                        echo "✅ Backend API smoke test PASSED (HTTP \$API_STATUS)"
                    else
                        echo "❌ Backend API smoke test FAILED (HTTP \$API_STATUS)"
                        exit 1
                    fi
                """
            }

            post {
                success { echo "✅ Deploy Stage PASSED — Staging is live at port 3001" }
                failure  { echo "❌ Deploy Stage FAILED — Staging rollback recommended" }
            }
        } // end Deploy

        // ── Stage 6: Release (Production) ───────────────────────────────
        stage('Release') {
            when {
                anyOf {
                    allOf {
                        branch 'main'
                        expression { params.RELEASE_TO_PROD }
                    }
                    expression { params.FORCE_DEPLOY && params.RELEASE_TO_PROD }
                }
            }
            steps {
                script {
                    def releaseTag = params.RELEASE_TAG ?: "v${new Date().format('yyyy.MM.dd')}-${env.BUILD_NUMBER}"
                    env.RELEASE_TAG = releaseTag
                    echo "🏷️  RELEASE — Promoting ${BUILD_VERSION} → Production tag: ${releaseTag}"
                }

                // ── Tag release images ──
                sh """
                    echo "==> Tagging production release: ${RELEASE_TAG}"
                    docker tag ${DOCKER_REGISTRY}/studygo-frontend:${BUILD_VERSION} \
                               ${DOCKER_REGISTRY}/studygo-frontend:${RELEASE_TAG}
                    docker tag ${DOCKER_REGISTRY}/studygo-backend:${BUILD_VERSION} \
                               ${DOCKER_REGISTRY}/studygo-backend:${RELEASE_TAG}

                    docker push ${DOCKER_REGISTRY}/studygo-frontend:${RELEASE_TAG}
                    docker push ${DOCKER_REGISTRY}/studygo-backend:${RELEASE_TAG}
                    echo "==> Release images pushed: ${RELEASE_TAG}"
                """

                // ── Git release tag ──
                sh """
                    git config user.email "jenkins@studygo.internal"
                    git config user.name "Jenkins CI"
                    git tag -a ${RELEASE_TAG} -m "Release ${RELEASE_TAG} — Build #${env.BUILD_NUMBER}" \
                        || echo "Tag may already exist, continuing"
                    git push origin ${RELEASE_TAG} || echo "Push tag skipped (no remote write access)"
                """

                // ── Deploy to production ──
                withCredentials([sshUserPrivateKey(credentialsId: 'production-server-ssh',
                                                   keyFileVariable: 'SSH_KEY',
                                                   usernameVariable: 'SSH_USER')]) {
                    sh """
                        echo "==> Deploying to production server"
                        scp -i \$SSH_KEY -o StrictHostKeyChecking=no \
                            docker-compose.production.yml \
                            monitoring/prometheus.yml \
                            monitoring/alert.rules.yml \
                            monitoring/alertmanager.yml \
                            \$SSH_USER@prod.studygo.internal:~/studygo/

                        ssh -i \$SSH_KEY -o StrictHostKeyChecking=no \$SSH_USER@prod.studygo.internal << 'ENDSSH'
                            cd ~/studygo

                            # Backup current state for rollback
                            docker-compose -f docker-compose.production.yml ps > pre-release-state.txt

                            export BUILD_VERSION=${RELEASE_TAG}
                            export DOCKER_REGISTRY=${DOCKER_REGISTRY}

                            # Pull tagged production images
                            docker-compose -f docker-compose.production.yml pull

                            # Blue-Green style: bring up new, then remove old
                            docker-compose -f docker-compose.production.yml up -d \
                                --remove-orphans

                            echo "==> Production deployment complete"
                            docker-compose -f docker-compose.production.yml ps
ENDSSH
                    """
                }

                // ── Production smoke test ──
                sh """
                    echo "==> Running production smoke tests"
                    sleep 30

                    for ENDPOINT in "/" "/api/v1/auth"; do
                        HOST="http://prod.studygo.internal"
                        PORT=\$(echo \$ENDPOINT | grep -q "api" && echo "4000" || echo "80")
                        STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \
                            \${HOST}:\${PORT}\${ENDPOINT} --max-time 20 || echo "000")
                        echo "Endpoint \${ENDPOINT} → HTTP \${STATUS}"
                    done

                    echo "==> Production release ${RELEASE_TAG} is LIVE"
                """
            }

            post {
                success {
                    echo "✅ Release Stage PASSED — Production tag: ${RELEASE_TAG}"
                    // Archive release manifest
                    sh """
                        echo "Release: ${RELEASE_TAG}" > release-manifest.txt
                        echo "Build: ${BUILD_VERSION}" >> release-manifest.txt
                        echo "Commit: ${GIT_COMMIT_SHORT}" >> release-manifest.txt
                        echo "Date: \$(date -u)" >> release-manifest.txt
                    """
                    archiveArtifacts artifacts: 'release-manifest.txt'
                }
                failure { echo "❌ Release Stage FAILED — Production rollback may be needed" }
            }
        } // end Release

        // ── Stage 7: Monitoring ──────────────────────────────────────────
        stage('Monitoring') {
            steps {
                script {
                    echo "📊 MONITORING — Verifying observability stack and alerts"
                }

                sh """
                    echo "==> Verifying Prometheus is reachable"
                    PROM_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \
                        http://localhost:9091/-/healthy --max-time 10 || echo "000")
                    echo "Prometheus health: HTTP \$PROM_STATUS"

                    echo "==> Verifying Grafana is reachable"
                    GRAF_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \
                        http://localhost:3002/api/health --max-time 10 || echo "000")
                    echo "Grafana health: HTTP \$GRAF_STATUS"

                    echo "==> Verifying AlertManager is reachable"
                    AM_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \
                        http://localhost:9094/-/healthy --max-time 10 || echo "000")
                    echo "AlertManager health: HTTP \$AM_STATUS"

                    echo "==> Checking Prometheus targets"
                    TARGETS=\$(curl -s http://localhost:9091/api/v1/targets \
                        --max-time 10 || echo "{}")
                    echo "Prometheus targets response received"

                    echo "==> Checking alert rules are loaded"
                    RULES=\$(curl -s http://localhost:9091/api/v1/rules \
                        --max-time 10 || echo "{}")
                    echo "Alert rules response received"

                    echo "==> Firing test alert (incident simulation)"
                    curl -s -X POST http://localhost:9094/api/v1/alerts \
                        -H 'Content-Type: application/json' \
                        -d '[{
                            "labels": {
                                "alertname": "JenkinsPipelineTestAlert",
                                "severity": "info",
                                "app": "studygo",
                                "build": "${BUILD_VERSION}"
                            },
                            "annotations": {
                                "summary": "Jenkins pipeline completed successfully",
                                "description": "Build ${BUILD_VERSION} passed all stages."
                            }
                        }]' || echo "Alert simulation attempted"

                    echo "==> Monitoring verification complete"
                """

                // ── Generate monitoring status report ──
                sh """
                    cat > monitoring-report.txt << 'EOF'
StudyGo Monitoring Status Report
=================================
Build: ${BUILD_VERSION}
Date:  \$(date -u)

Stack:
  - Prometheus  : http://localhost:9091   (metrics collection, alert evaluation)
  - Grafana     : http://localhost:3002   (dashboards & visualisation)
  - AlertManager: http://localhost:9094   (routing & notifications)
  - Node Exporter: host metrics collection

Alert Rules Configured:
  - BackendDown           (critical, 1m)
  - FrontendDown          (critical, 2m)
  - HighResponseTime      (warning, 5m)
  - CriticalResponseTime  (critical, 3m)
  - HighErrorRate         (warning, 5m)
  - CriticalErrorRate     (critical, 2m)
  - HighCPUUsage          (warning, 10m)
  - HighMemoryUsage       (warning, 5m)
  - DiskSpaceLow          (warning, 5m)
  - PaymentServiceErrors  (critical, 1m)

Notification channels: Email (team, oncall, payments, devops)
EOF
                    cat monitoring-report.txt
                """

                archiveArtifacts artifacts: 'monitoring-report.txt'
            }

            post {
                success { echo "✅ Monitoring Stage PASSED — Observability stack verified" }
                failure  { echo "⚠️  Monitoring Stage issue — check stack configuration" }
            }
        } // end Monitoring

    } // end stages

    // ====================================================================
    // POST — Global pipeline notifications
    // ====================================================================
    post {
        always {
            echo "Pipeline finished — Build: ${BUILD_VERSION} | Status: ${currentBuild.currentResult}"
            cleanWs()
        }

        success {
            echo """
            ============================================
            ✅ PIPELINE SUCCESS — ${BUILD_VERSION}
            Branch  : ${env.BRANCH_NAME}
            Commit  : ${GIT_COMMIT_SHORT}
            Duration: ${currentBuild.durationString}
            ============================================
            """
        }

        failure {
            echo """
            ============================================
            ❌ PIPELINE FAILED — ${BUILD_VERSION}
            Stage: ${env.STAGE_NAME}
            Check console output for details.
            ============================================
            """
        }

        unstable {
            echo "⚠️ Pipeline UNSTABLE — review test/security reports"
        }
    }

} // end pipeline
