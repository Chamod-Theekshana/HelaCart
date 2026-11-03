import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/core/network/api_client.dart';

class Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  Future<ResponseBody> Function(RequestOptions)? respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? body,
    Future<void>? cancel,
  ) async {
    requests.add(options);
    return respond == null
        ? ResponseBody.fromString(
            '{}',
            200,
            headers: {
              'content-type': ['application/json'],
            },
          )
        : respond!(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody response(int status, Object data) => ResponseBody.fromString(
  jsonEncode(data),
  status,
  headers: {
    'content-type': ['application/json'],
  },
);
void main() {
  late Adapter adapter;
  late ApiClient api;
  late Dio dio;
  String? owner;
  var refreshes = 0;
  setUp(() {
    owner = 'a';
    refreshes = 0;
    adapter = Adapter();
    dio = Dio(BaseOptions(baseUrl: 'https://api.example.test/api/v1'));
    dio.httpClientAdapter = adapter;
    api = ApiClient(
      dio,
      identity: () => owner,
      token: (refresh) async {
        if (refresh) refreshes++;
        return owner == null ? null : 'token-$owner';
      },
    );
  });
  tearDown(() => dio.close());
  test('public browsing does not attach authentication', () async {
    await api.request('/categories');
    expect(adapter.requests.single.headers['Authorization'], isNull);
  });
  test('private requests attach the current Firebase ID token', () async {
    await api.request('/me/cart', private: true);
    expect(adapter.requests.single.headers['Authorization'], 'Bearer token-a');
  });
  test('anonymous protected requests never dispatch', () async {
    owner = null;
    await expectLater(
      api.request('/me/cart', private: true),
      throwsA(isA<AppFailure>()),
    );
    expect(adapter.requests, isEmpty);
  });
  test('expired read refreshes once', () async {
    adapter.respond = (_) async => adapter.requests.length == 1
        ? response(401, {'message': 'Expired'})
        : response(200, {'ok': true});
    await api.request('/me/cart', private: true);
    expect(refreshes, 1);
    expect(adapter.requests.length, 2);
  });
  test('mutations are never automatically replayed after 401', () async {
    adapter.respond = (_) async => response(401, {'message': 'Expired'});
    await expectLater(
      api.request(
        '/me/orders/checkout',
        method: 'POST',
        private: true,
        data: {},
      ),
      throwsA(isA<AppFailure>()),
    );
    expect(adapter.requests.length, 1);
    expect(refreshes, 0);
  });
  test('late private response is rejected after account switch', () async {
    adapter.respond = (_) async {
      owner = 'b';
      return response(200, {'private': 'buyer-a'});
    };
    await expectLater(
      api.request('/auth/me', private: true),
      throwsA(isA<AppFailure>()),
    );
  });
  test('account change while obtaining token blocks dispatch', () async {
    api = ApiClient(
      dio,
      identity: () => owner,
      token: (_) async {
        owner = 'b';
        return 'token-b';
      },
    );
    await expectLater(
      api.request('/auth/me', method: 'PATCH', private: true, data: {}),
      throwsA(isA<AppFailure>()),
    );
    expect(adapter.requests, isEmpty);
  });
  test(
    'async action ownership blocks a stale form before token acquisition',
    () async {
      owner = 'b';
      await expectLater(
        runZoned(
          () =>
              api.request('/auth/me', method: 'PATCH', private: true, data: {}),
          zoneValues: {#helacartActionOwner: 'a'},
        ),
        throwsA(isA<AppFailure>()),
      );
      expect(adapter.requests, isEmpty);
    },
  );
  test(
    'validation messages are displayed without raw transport errors',
    () async {
      adapter.respond = (_) async => response(400, {
        'message': ['Invalid district', 'Invalid phone'],
      });
      await expectLater(
        api.request('/me/addresses', method: 'POST', private: true, data: {}),
        throwsA(
          isA<AppFailure>().having(
            (e) => e.message,
            'message',
            'Invalid district\nInvalid phone',
          ),
        ),
      );
    },
  );
}
