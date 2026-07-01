pipeline {
    agent any

    tools {
        nodejs "NodeJS-LTS"
    }

    environment {
    SCANNER_HOME = tool('SonarScanner')

    AWS_REGION = 'ap-south-1'
    AWS_ACCOUNT = '232939969354'

    FRONTEND_IMAGE = 'brainbox-frontend'
    BACKEND_IMAGE = 'brainbox-backend'

    FRONTEND_ECR = '232939969354.dkr.ecr.ap-south-1.amazonaws.com/dev-brainbox-frontend'
    BACKEND_ECR = '232939969354.dkr.ecr.ap-south-1.amazonaws.com/dev-brainbox-backend'
 }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                    $SCANNER_HOME/bin/sonar-scanner
                    '''
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Frontend Install') {
            steps {
                dir('client') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('client') {
                    sh 'npm run build'
                }
            }
        }

        stage('Backend Install') {
            steps {
                dir('server') {
                    sh 'npm install'
                }
            }
        }

        stage('Backend Check') {
            steps {
                dir('server') {
                    sh 'node --version'
                }
            }
        }

        stage('Docker Build - Frontend') {
            steps {
                sh '''
                docker build -t brainbox-frontend:${BUILD_NUMBER} ./client
                '''
            }
        }

        stage('Docker Build - Backend') {
            steps {
                sh '''
                docker build -t brainbox-backend:${BUILD_NUMBER} ./server
                '''
            }
        }

        stage('Trivy Scan - Frontend') {
            steps {
                sh '''
                trivy image --severity CRITICAL --no-progress brainbox-frontend:${BUILD_NUMBER}
                '''
            }
        }

        stage('Trivy Scan - Backend') {
            steps {
                sh '''
                trivy image --severity CRITICAL --no-progress brainbox-backend:${BUILD_NUMBER}
                '''
            }
        }
    }
    stage('Login to Amazon ECR') {
    steps {
        withCredentials([[
            $class: 'AmazonWebServicesCredentialsBinding',
            credentialsId: 'aws-creds'
        ]]) {
            sh '''
            aws ecr get-login-password --region $AWS_REGION | \
            docker login --username AWS --password-stdin \
            $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com
            '''
          }
      }
   }

   stage('Push Frontend Image') {
    steps {
        sh '''
        docker tag ${FRONTEND_IMAGE}:${BUILD_NUMBER} ${FRONTEND_ECR}:${BUILD_NUMBER}
        docker push ${FRONTEND_ECR}:${BUILD_NUMBER}
        '''
      }
   }
   stage('Push Backend Image') {
    steps {
        sh '''
        docker tag ${BACKEND_IMAGE}:${BUILD_NUMBER} ${BACKEND_ECR}:${BUILD_NUMBER}
        docker push ${BACKEND_ECR}:${BUILD_NUMBER}
        '''
      }
   }
    post {
        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed.'
        }
    }
}
