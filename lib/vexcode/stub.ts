// Stub headers declaring the VEX V5 C++ API surface (spec Appendix F) so g++ -fsyntax-only can check student code.
// Signatures follow api.vex.com; verify any you add.
export const V5_H = `#pragma once
#include <stdint.h>
#include <stddef.h>
namespace vex {
enum directionType { fwd = 0, rev };
static const directionType forward = fwd;
static const directionType reverse = rev;
enum turnType { left = 0, right };
enum velocityUnits { pct = 0, rpm, dps };
enum percentUnits { percent = 0 };
enum rotationUnits { deg = 0, rev_units, raw };
static const rotationUnits degrees = deg;
static const rotationUnits turns = rev_units;
enum distanceUnits { mm = 0, in, cm };
static const distanceUnits inches = in;
enum timeUnits { sec = 0, msec };
static const timeUnits seconds = sec;
enum brakeType { coast = 0, brake, hold };
enum gearSetting { ratio36_1 = 0, ratio18_1, ratio6_1 };
enum controllerType { primary = 0, partner };
enum ledState { off = 0, on };
enum analogUnits { pctUnits = 0 };
enum torqueUnits { Nm = 0, InLb };
enum currentUnits { amp = 0 };
enum temperatureUnits { celsius = 0, fahrenheit };
constexpr int32_t PORT1 = 0, PORT2 = 1, PORT3 = 2, PORT4 = 3, PORT5 = 4, PORT6 = 5, PORT7 = 6, PORT8 = 7,
  PORT9 = 8, PORT10 = 9, PORT11 = 10, PORT12 = 11, PORT13 = 12, PORT14 = 13, PORT15 = 14, PORT16 = 15,
  PORT17 = 16, PORT18 = 17, PORT19 = 18, PORT20 = 19, PORT21 = 20;

void wait(double time, timeUnits units = msec);

namespace this_thread { void sleep_for(uint32_t ms); }

class timer {
public:
  timer();
  double time(timeUnits units = msec) const;
  void clear();
  void reset();
};

class triport {
public:
  class port { public: port(); };
  port A, B, C, D, E, F, G, H;
};

class brain {
public:
  class lcd {
  public:
    void print(const char *format, ...);
    void print(int value);
    void print(double value);
    void newLine();
    void clearScreen();
    void clearLine();
    void clearLine(int row);
    void setCursor(int32_t row, int32_t col);
    void setFont(int font);
    void setPenColor(int color);
    void drawRectangle(int x, int y, int w, int h);
    void drawCircle(int x, int y, int r);
  };
  class battery { public: uint32_t capacity(percentUnits units = percent); double voltage(); double current(); };
  lcd Screen;
  battery Battery;
  triport ThreeWirePort;
  timer Timer;
  brain();
};

class controller {
public:
  class axis { public: int32_t position(percentUnits units = percent); int32_t value(); void changed(void (*callback)(void)); };
  class button { public: bool pressing(); void pressed(void (*callback)(void)); void released(void (*callback)(void)); };
  class lcd { public: void print(const char *format, ...); void print(int value); void print(double value); void clearScreen(); void clearLine(int row); void setCursor(int32_t row, int32_t col); void newLine(); };
  axis Axis1, Axis2, Axis3, Axis4;
  button ButtonA, ButtonB, ButtonX, ButtonY, ButtonUp, ButtonDown, ButtonLeft, ButtonRight, ButtonL1, ButtonL2, ButtonR1, ButtonR2;
  lcd Screen;
  controller(controllerType id = primary);
  void rumble(const char *pattern);
};

class device { public: bool installed(); int32_t index(); };

class motor : public device {
public:
  motor(int32_t index);
  motor(int32_t index, bool reverse);
  motor(int32_t index, gearSetting gears);
  motor(int32_t index, gearSetting gears, bool reverse);
  void spin(directionType dir);
  void spin(directionType dir, double velocity, velocityUnits units);
  void spin(directionType dir, double velocity, percentUnits units);
  bool spinFor(directionType dir, double rotation, rotationUnits units, bool waitForCompletion = true);
  bool spinFor(double rotation, rotationUnits units, double velocity, velocityUnits units_v, bool waitForCompletion = true);
  bool spinFor(double rotation, rotationUnits units, bool waitForCompletion = true);
  bool spinFor(directionType dir, double time, timeUnits units, double velocity, velocityUnits units_v);
  bool spinToPosition(double rotation, rotationUnits units, bool waitForCompletion = true);
  bool spinToPosition(double rotation, rotationUnits units, double velocity, velocityUnits units_v, bool waitForCompletion = true);
  void stop();
  void stop(brakeType mode);
  void setVelocity(double velocity, velocityUnits units);
  void setVelocity(double velocity, percentUnits units);
  void setStopping(brakeType mode);
  void setMaxTorque(double value, percentUnits units);
  void setReversed(bool value);
  void setTimeout(int32_t time, timeUnits units);
  void resetPosition();
  void setPosition(double value, rotationUnits units);
  double position(rotationUnits units);
  double velocity(velocityUnits units);
  double velocity(percentUnits units);
  double torque(torqueUnits units = Nm);
  double current(currentUnits units = amp);
  double temperature(percentUnits units);
  double temperature(temperatureUnits units);
  bool isSpinning();
  bool isDone();
};

class motor_group {
public:
  template <typename... Args> motor_group(motor &m1, Args &...m2);
  motor_group();
  void spin(directionType dir);
  void spin(directionType dir, double velocity, velocityUnits units);
  void spin(directionType dir, double velocity, percentUnits units);
  bool spinFor(directionType dir, double rotation, rotationUnits units, bool waitForCompletion = true);
  bool spinFor(double rotation, rotationUnits units, double velocity, velocityUnits units_v, bool waitForCompletion = true);
  bool spinFor(double rotation, rotationUnits units, bool waitForCompletion = true);
  bool spinToPosition(double rotation, rotationUnits units, bool waitForCompletion = true);
  void stop();
  void stop(brakeType mode);
  void setVelocity(double velocity, velocityUnits units);
  void setVelocity(double velocity, percentUnits units);
  void setStopping(brakeType mode);
  void setMaxTorque(double value, percentUnits units);
  void resetPosition();
  void setPosition(double value, rotationUnits units);
  double position(rotationUnits units);
  double velocity(velocityUnits units);
  double velocity(percentUnits units);
  bool isSpinning();
  bool isDone();
  int32_t count();
};

class inertial : public device {
public:
  inertial(int32_t index);
  void calibrate();
  bool isCalibrating();
  double heading(rotationUnits units = degrees);
  double rotation(rotationUnits units = degrees);
  void setHeading(double value, rotationUnits units);
  void setRotation(double value, rotationUnits units);
  void resetHeading();
  void resetRotation();
  double pitch(rotationUnits units = degrees);
  double roll(rotationUnits units = degrees);
  double yaw(rotationUnits units = degrees);
};

class rotation : public device {
public:
  rotation(int32_t index, bool reverse = false);
  double position(rotationUnits units);
  double angle(rotationUnits units = degrees);
  double velocity(velocityUnits units);
  void resetPosition();
  void setPosition(double value, rotationUnits units);
  void setReversed(bool value);
};

class optical : public device {
public:
  optical(int32_t index);
  double hue();
  double brightness(bool bRaw = false);
  bool isNearObject();
  void setLight(ledState state);
  void setLightPower(double value, percentUnits units);
  void objectDetected(void (*callback)(void));
};

class distance : public device {
public:
  distance(int32_t index);
  double objectDistance(distanceUnits units);
  int32_t objectSize();
  double objectVelocity();
  bool isObjectDetected();
};

class gps : public device {
public:
  gps(int32_t index, double heading_offset = 0, turnType dir = right);
  gps(int32_t index, double ox, double oy, distanceUnits units, double heading_offset, turnType dir = right);
  double xPosition(distanceUnits units = mm);
  double yPosition(distanceUnits units = mm);
  double heading(rotationUnits units = degrees);
};

class digital_out { public: digital_out(triport::port &port); void set(bool value); bool value(); };
class digital_in { public: digital_in(triport::port &port); bool value(); };
class limit { public: limit(triport::port &port); bool pressing(); void pressed(void (*callback)(void)); };
class bumper { public: bumper(triport::port &port); bool pressing(); void pressed(void (*callback)(void)); };

class drivetrain {
public:
  drivetrain(motor_group &l, motor_group &r, double wheelTravel = 320, double trackWidth = 320, double wheelBase = 130, distanceUnits unit = mm, double externalGearRatio = 1.0);
  drivetrain(motor &l, motor &r, double wheelTravel = 320, double trackWidth = 320, double wheelBase = 130, distanceUnits unit = mm, double externalGearRatio = 1.0);
  void drive(directionType dir);
  void drive(directionType dir, double velocity, velocityUnits units);
  bool driveFor(directionType dir, double distance, distanceUnits units, bool waitForCompletion = true);
  bool driveFor(double distance, distanceUnits units, bool waitForCompletion = true);
  bool driveFor(directionType dir, double distance, distanceUnits units, double velocity, velocityUnits units_v, bool waitForCompletion = true);
  void turn(turnType dir);
  bool turnFor(turnType dir, double angle, rotationUnits units, bool waitForCompletion = true);
  bool turnFor(double angle, rotationUnits units, bool waitForCompletion = true);
  void stop();
  void stop(brakeType mode);
  void setDriveVelocity(double velocity, percentUnits units);
  void setDriveVelocity(double velocity, velocityUnits units);
  void setTurnVelocity(double velocity, percentUnits units);
  void setTurnVelocity(double velocity, velocityUnits units);
  void setStopping(brakeType mode);
  void setTimeout(int32_t time, timeUnits units);
  bool isMoving();
  bool isDone();
};

class smartdrive : public drivetrain {
public:
  smartdrive(motor_group &l, motor_group &r, inertial &g, double wheelTravel = 320, double trackWidth = 320, double wheelBase = 130, distanceUnits unit = mm, double externalGearRatio = 1.0);
  smartdrive(motor &l, motor &r, inertial &g, double wheelTravel = 320, double trackWidth = 320, double wheelBase = 130, distanceUnits unit = mm, double externalGearRatio = 1.0);
  bool turnToHeading(double angle, rotationUnits units, bool waitForCompletion = true);
  bool turnToRotation(double angle, rotationUnits units, bool waitForCompletion = true);
  void setHeading(double value, rotationUnits units);
  double heading(rotationUnits units = degrees);
  double rotation(rotationUnits units = degrees);
};

class competition {
public:
  competition();
  void autonomous(void (*callback)(void));
  void drivercontrol(void (*callback)(void));
  bool isAutonomous();
  bool isDriverControl();
  bool isEnabled();
  bool isCompetitionSwitch();
  bool isFieldControl();
};

class task {
public:
  task(int (*callback)(void));
  task(int (*callback)(void), int32_t priority);
  void stop();
  void suspend();
  void resume();
};
} // namespace vex
`;

export const V5_VCS_H = `#pragma once
// VEXcode compatibility layer (stub).
`;

export const VEX_SYMBOLS = [
  'forward', 'reverse', 'left', 'right', 'percent', 'rpm', 'dps', 'degrees', 'turns', 'mm', 'inches', 'cm', 'seconds', 'msec',
  'coast', 'brake', 'hold', 'ratio36_1', 'ratio18_1', 'ratio6_1', 'primary', 'partner',
  'spin', 'spinFor', 'spinToPosition', 'stop', 'setVelocity', 'setStopping', 'setMaxTorque', 'resetPosition', 'setPosition', 'position', 'velocity', 'torque', 'current', 'temperature', 'isSpinning', 'isDone',
  'drive', 'driveFor', 'turn', 'turnFor', 'turnToHeading', 'setDriveVelocity', 'setTurnVelocity', 'setHeading', 'heading', 'isMoving',
  'calibrate', 'isCalibrating', 'rotation', 'pitch', 'roll', 'yaw', 'angle', 'hue', 'brightness', 'isNearObject', 'setLight', 'objectDistance', 'isObjectDetected',
  'pressing', 'pressed', 'released', 'Axis1', 'Axis2', 'Axis3', 'Axis4', 'ButtonA', 'ButtonB', 'ButtonX', 'ButtonY', 'ButtonL1', 'ButtonL2', 'ButtonR1', 'ButtonR2', 'ButtonUp', 'ButtonDown', 'ButtonLeft', 'ButtonRight',
  'wait', 'waitUntil', 'repeat', 'Brain', 'Controller1', 'Screen', 'print', 'newLine', 'clearScreen', 'setCursor', 'clearLine', 'Competition', 'autonomous', 'drivercontrol', 'set', 'value',
];
