import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/app/hc.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'buyer_flows_test.dart' show openBuyer;
import 'support/buyer_fixture.dart';

void main() {
  setUpAll(tz.initializeTimeZones);

  testWidgets('tapping a notification marks it read and opens its order', (
    tester,
  ) async {
    final repo = BuyerFixture();
    await openBuyer(tester, '/notifications', repo);
    final message = find.text('Your shop package has shipped');
    await tester.tap(message);
    await tester.pumpAndSettle();
    expect(repo.writes.single.path, '/me/notifications/notice-a/read');
    expect(repo.writes.single.method, 'PATCH');
    expect(find.text('Order details'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('failed notification tap shows an error and allows retry', (
    tester,
  ) async {
    final repo = BuyerFixture();
    var fail = true;
    repo.onWrite = (path, method, data) async {
      if (fail) throw const AppFailure('Unable to mark as read.');
      return {};
    };
    await openBuyer(tester, '/notifications', repo);
    final message = find.text('Your shop package has shipped');
    await tester.tap(message);
    await tester.pumpAndSettle();
    expect(find.text('Unable to mark as read.'), findsOneWidget);
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Order details'), findsNothing);
    fail = false;
    await tester.tap(message);
    await tester.pumpAndSettle();
    expect(repo.writes.length, 2);
    expect(find.text('Order details'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
