import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:helacart_buyer_mobile_app/core/ui/widgets.dart';

void main() {
  const empty = EmptyState(title: 'Nothing here', message: 'Try again later');

  Future<void> pump(WidgetTester tester, Widget body) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: body)));
  }

  testWidgets('centres a full-page empty state on both axes', (tester) async {
    await pump(tester, empty);
    final centre = tester.getCenter(find.byType(CircleAvatar));
    final screen = tester.getCenter(find.byType(Scaffold));
    expect(centre.dx, moreOrLessEquals(screen.dx, epsilon: 1));
    // The icon sits above the text, so the block's middle is the screen's.
    final block = tester.getRect(find.byType(Column).first);
    expect(block.center.dy, moreOrLessEquals(screen.dy, epsilon: 1));
  });

  testWidgets('centres horizontally inside a scrolling list', (tester) async {
    await pump(
      tester,
      ListView(
        children: const [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [empty],
          ),
        ],
      ),
    );
    final centre = tester.getCenter(find.byType(CircleAvatar));
    expect(centre.dx, moreOrLessEquals(195, epsilon: 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('scrolls instead of overflowing on a short screen', (
    tester,
  ) async {
    await pump(tester, const SizedBox(height: 120, child: empty));
    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsOneWidget);
  });
}
