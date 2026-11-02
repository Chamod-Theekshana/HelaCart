import 'dart:typed_data';
import 'dart:async';

import 'package:dio/dio.dart';

import '../../l10n/app_strings.dart';
import '../data/json.dart';

class AppFailure implements Exception {
  const AppFailure(this.message, {this.status, this.code});
  final String message;
  final int? status;

  /// Stable machine-readable error code from the API body (`code`), e.g.
  /// `PHONE_NOT_VERIFIED`. Clients branch on this, never on [message].
  final String? code;

  /// The API answered and refused this exact checkout attempt, so the saved
  /// attempt can never succeed and is cleared. 401/429/5xx/network failures
  /// stay uncertain and keep the attempt for a safe recheck.
  bool get definitiveCheckoutRejection =>
      [400, 403, 404, 409, 422].contains(status);
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this.dio, {required this.token, required this.identity});
  final Dio dio;
  final Future<String?> Function(bool refresh) token;
  final String? Function() identity;
  Future<Object?> request(
    String path, {
    String method = 'GET',
    Object? data,
    Map<String, dynamic>? query,
    bool private = false,
    CancelToken? cancel,
  }) async {
    final owner = identity();
    final actionOwner = Zone.current[#helacartActionOwner] as String?;
    if (private && actionOwner != null && actionOwner != owner) {
      throw const AppFailure(
        'Your account changed. Reopen this action from your account.',
      );
    }
    try {
      final authToken = private ? await token(false) : null;
      if (private && authToken == null) {
        throw const AppFailure('Sign in to continue.', status: 401);
      }
      if (private && owner != identity()) {
        throw const AppFailure('Your account changed. Open this screen again.');
      }
      final response = await dio.request<Object?>(
        path,
        data: data,
        queryParameters: query,
        cancelToken: cancel,
        options: Options(
          method: method,
          headers: {
            if (authToken != null) 'Authorization': 'Bearer $authToken',
          },
          receiveTimeout: Duration(
            seconds: data is FormData || path.endsWith('/checkout') ? 65 : 20,
          ),
        ),
      );
      if (private && owner != identity()) {
        throw const AppFailure('Your account changed. Open this screen again.');
      }
      return response.data;
    } on DioException catch (error) {
      // Only reads can refresh/retry automatically. Never replay a mutation.
      if (private &&
          method == 'GET' &&
          error.response?.statusCode == 401 &&
          owner == identity()) {
        final refreshed = await token(true);
        if (refreshed != null && owner == identity()) {
          try {
            final response = await dio.get<Object?>(
              path,
              queryParameters: query,
              cancelToken: cancel,
              options: Options(headers: {'Authorization': 'Bearer $refreshed'}),
            );
            if (owner != identity()) {
              throw const AppFailure('Your account changed.');
            }
            return response.data;
          } on DioException catch (retryError) {
            throw failureFrom(retryError);
          }
        }
      }
      throw failureFrom(error);
    }
  }

  Future<Uint8List> privateImage(String path) async {
    final owner = identity(), value = await token(false);
    if (value == null) throw const AppFailure('Sign in to view this image.');
    try {
      final result = await dio.get<List<int>>(
        path,
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Authorization': 'Bearer $value'},
        ),
      );
      if (owner != identity()) throw const AppFailure('Your account changed.');
      return Uint8List.fromList(result.data ?? []);
    } on DioException catch (error) {
      throw failureFrom(error);
    }
  }
}

AppFailure failureFrom(DioException error) {
  final status = error.response?.statusCode;
  final body = object(error.response?.data);
  final detail = body['message'];
  final code = body['code'];
  final message = detail is List
      ? detail.join('\n')
      : detail is String
      ? detail
      : null;
  final strings = AppStrings.current;
  return AppFailure(
    message ??
        strings.t(
          status == 403
              ? 'error.forbidden'
              : status == 404
              ? 'error.notFound'
              : status == 429
              ? 'error.rateLimited'
              : 'error.network',
        ),
    status: status,
    code: code is String && code.isNotEmpty ? code : null,
  );
}
