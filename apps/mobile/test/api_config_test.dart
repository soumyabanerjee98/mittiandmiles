import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mittiandmiles/core/config/api_config.dart';

void main() {
  test('fromEnv reads API_BASE_URL', () {
    dotenv.testLoad(fileInput: 'API_BASE_URL=https://api.example.test\n');
    final config = ApiConfig.fromEnv();
    expect(config.baseUrl, 'https://api.example.test');
  });

  test('fromEnv fails when API_BASE_URL is missing', () {
    dotenv.testLoad(fileInput: '');
    expect(() => ApiConfig.fromEnv(), throwsStateError);
  });
}
