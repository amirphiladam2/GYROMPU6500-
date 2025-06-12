#include "FastIMU.h"
#include <Wire.h>

// ---------- Configuration ----------
#define IMU_ADDRESS 0x68          // Change if your IMU address differs
#define PERFORM_CALIBRATION       // Comment this out to skip calibration

MPU6500 IMU;                      // Use the IMU you're actually using (e.g., MPU9250, MPU6050, etc.)

calData calib = { 0 };           // Calibration data structure
AccelData accelData;
GyroData gyroData;
float roll = 0, pitch = 0, yaw = 0;
unsigned long lastTime = 0;

void setup() {
  Wire.begin();            // Modify pins depending on your board
  Wire.setClock(400000);         // Use 400 kHz I2C clock
  Serial.begin(115200);
  while (!Serial);               // Wait for serial port to be ready

  int err = IMU.init(calib, IMU_ADDRESS);
  if (err != 0) {
    Serial.print("Error initializing IMU: ");
    Serial.println(err);
    while (true);                // Halt on error
  }

#ifdef PERFORM_CALIBRATION
  Serial.println("Starting calibration...");
  delay(2500);
  Serial.println("Keep IMU flat and still...");
  delay(5000);
  IMU.calibrateAccelGyro(&calib);
  Serial.println("Calibration complete.");
  
  Serial.print("Accel Biases (X/Y/Z): ");
  Serial.print(calib.accelBias[0]); Serial.print(", ");
  Serial.print(calib.accelBias[1]); Serial.print(", ");
  Serial.println(calib.accelBias[2]);

  Serial.print("Gyro Biases (X/Y/Z): ");
  Serial.print(calib.gyroBias[0]); Serial.print(", ");
  Serial.print(calib.gyroBias[1]); Serial.print(", ");
  Serial.println(calib.gyroBias[2]);

  delay(3000);

  // Re-initialize IMU with new calibration data
  err = IMU.init(calib, IMU_ADDRESS);
  if (err != 0) {
    Serial.print("Error reinitializing IMU after calibration: ");
    Serial.println(err);
    while (true);
  }
#endif

  // Optional: Set range (check your IMU's capabilities first)
  // err = IMU.setGyroRange(500);  
  // err = IMU.setAccelRange(2);

  if (err != 0) {
    Serial.print("Error setting sensor ranges: ");
    Serial.println(err);
    while (true);
  }
  
  lastTime = millis();
}

void loop() {
  IMU.update();

  IMU.getAccel(&accelData);
  IMU.getGyro(&gyroData);
  
  // Calculate attitude angles (simple complementary filter)
  unsigned long currentTime = millis();
  float dt = (currentTime - lastTime) / 1000.0;
  
  // Calculate angles from accelerometer
  float accelRoll = atan2(accelData.accelY, accelData.accelZ) * 180.0 / PI;
  float accelPitch = atan2(-accelData.accelX, sqrt(accelData.accelY * accelData.accelY + accelData.accelZ * accelData.accelZ)) * 180.0 / PI;
  
  // Integrate gyroscope data
  roll += gyroData.gyroX * dt;
  pitch += gyroData.gyroY * dt;
  yaw += gyroData.gyroZ * dt;
  
  // Apply complementary filter (98% gyro, 2% accel)
  roll = 0.98 * roll + 0.02 * accelRoll;
  pitch = 0.98 * pitch + 0.02 * accelPitch;
  
  // Send JSON data to serial
  Serial.print("{");
  Serial.print("\"timestamp\":");
  Serial.print(currentTime);
  Serial.print(",\"accel\":{");
  Serial.print("\"x\":");
  Serial.print(accelData.accelX, 3);
  Serial.print(",\"y\":");
  Serial.print(accelData.accelY, 3);
  Serial.print(",\"z\":");
  Serial.print(accelData.accelZ, 3);
  Serial.print("},\"gyro\":{");
  Serial.print("\"x\":");
  Serial.print(gyroData.gyroX, 3);
  Serial.print(",\"y\":");
  Serial.print(gyroData.gyroY, 3);
  Serial.print(",\"z\":");
  Serial.print(gyroData.gyroZ, 3);
  Serial.print("},\"attitude\":{");
  Serial.print("\"roll\":");
  Serial.print(roll, 2);
  Serial.print(",\"pitch\":");
  Serial.print(pitch, 2);
  Serial.print(",\"yaw\":");
  Serial.print(yaw, 2);
  Serial.print("}");
  
  if (IMU.hasTemperature()) {
    Serial.print(",\"temperature\":");
    Serial.print(IMU.getTemp(), 2);
  }
  
  Serial.println("}");
  
  lastTime = currentTime;
  delay(50);  // Reduced delay for more frequent updates
}