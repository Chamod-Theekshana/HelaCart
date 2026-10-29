import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/hc.dart';
import '../../../core/data/buyer_repository.dart';
import '../../catalog/presentation/product_widgets.dart';

class ReviewsScreen extends ConsumerStatefulWidget {
  const ReviewsScreen({super.key, required this.id, this.shop = false});
  final String id;
  final bool shop;
  @override
  ConsumerState<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends ConsumerState<ReviewsScreen> {
  int page = 1;
  String sort = 'newest', rating = '';
  String get base => widget.shop
      ? '/shops/${Uri.encodeComponent(widget.id)}/reviews'
      : '/products/${widget.id}/customer-reviews';
  String get accessPath => widget.shop
      ? '/shops/${Uri.encodeComponent(widget.id)}/review-access'
      : '$base/access';
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider).value;
    final access = user?.verified == true
        ? object(
            ref
                .watch(resourceProvider((path: accessPath, private: true)))
                .value,
          )
        : <String, dynamic>{};
    final ownIds = <String>{
      if (!widget.shop && access['review'] != null)
        string(object(access['review'])['id']),
      if (widget.shop)
        ...objects(access['myReviews']).map((r) => string(r['id'])),
    };
    return PageFrame(
      title: widget.shop ? 'Shop reviews' : 'Product reviews',
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          RemoteView(
            path:
                '$base?page=$page&sort=$sort${rating.isEmpty ? '' : '&rating=$rating'}',
            builder: (c, data) {
              final summary = object(data['summary']);
              final rows = objects(data['items']);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          integer(summary['total']) == 0
                              ? 'No reviews yet'
                              : '${summary['average']} ★',
                          style: Theme.of(c).textTheme.headlineSmall,
                        ),
                        Text(
                          '${integer(summary['total'])} verified-purchase reviews',
                        ),
                        verticalGap(12),
                        for (final row in objects(summary['breakdown']))
                          Row(
                            children: [
                              Text('${row['rating']} ★'),
                              const SizedBox(width: 12),
                              Expanded(
                                child: LinearProgressIndicator(
                                  value: integer(summary['total']) == 0
                                      ? 0
                                      : integer(row['count']) /
                                            integer(summary['total']),
                                  backgroundColor: HelaColors.wash,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text('${row['count']}'),
                            ],
                          ),
                      ],
                    ),
                  ),
                  verticalGap(),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final value in ['', '5', '4', '3', '2', '1'])
                        ChoiceChip(
                          label: Text(value.isEmpty ? 'All stars' : '$value ★'),
                          selected: rating == value,
                          onSelected: (_) => setState(() {
                            rating = value;
                            page = 1;
                          }),
                        ),
                    ],
                  ),
                  DropdownButton<String>(
                    value: sort,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'newest', child: Text('Newest')),
                      DropdownMenuItem(
                        value: 'highest',
                        child: Text('Highest rating'),
                      ),
                      DropdownMenuItem(
                        value: 'lowest',
                        child: Text('Lowest rating'),
                      ),
                    ],
                    onChanged: (v) => setState(() {
                      sort = v!;
                      page = 1;
                    }),
                  ),
                  if (rows.isEmpty)
                    const EmptyState(
                      title: 'Be the first to share your experience',
                      message:
                          'Reviews are available after a delivered purchase.',
                      icon: Icons.rate_review_outlined,
                    ),
                  for (final row in rows)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ReviewCard(
                        review: row,
                        photoBase: widget.shop
                            ? '$base/${row['id']}/photos'
                            : null,
                        report: ownIds.contains(row['id'])
                            ? null
                            : () => reportReview(
                                context,
                                ref,
                                widget.shop
                                    ? '$base/${row['id']}/report'
                                    : '$base/${row['id']}/reports',
                              ),
                      ),
                    ),
                  Pager(
                    page: page,
                    pages: integer(data['pages'], 1),
                    change: (p) => setState(() => page = p),
                  ),
                ],
              );
            },
          ),
          if (widget.shop) ShopTabs(slug: widget.id, selected: 'reviews'),
          const SectionTitle('Your experience'),
          if (user == null || !user.verified)
            Protected(child: const SizedBox.shrink())
          else
            RemoteView(
              path: accessPath,
              private: true,
              builder: (c, access) => widget.shop
                  ? ShopReviewEditor(slug: widget.id, access: access)
                  : ProductReviewEditor(productId: widget.id, access: access),
            ),
        ],
      ),
    );
  }
}

class ReviewCard extends StatelessWidget {
  const ReviewCard({
    super.key,
    required this.review,
    this.photoBase,
    this.report,
  });
  final Json review;
  final String? photoBase;
  final VoidCallback? report;
  @override
  Widget build(BuildContext context) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                string(review['buyerName'], 'Buyer'),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              '★ ${integer(review['rating'])}',
              style: const TextStyle(
                color: HelaColors.teal,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        verticalGap(6),
        const Text(
          'Verified purchase',
          style: TextStyle(color: HelaColors.teal, fontSize: 11),
        ),
        Text(
          dateText(review['createdAt']),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (string(review['variantLabel']).isNotEmpty)
          Text(
            string(review['variantLabel']),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        verticalGap(10),
        Text(string(review['comment'])),
        if (photoBase != null && objects(review['photos']).isNotEmpty) ...[
          verticalGap(10),
          Wrap(
            spacing: 8,
            children: objects(review['photos'])
                .map(
                  (p) => SizedBox(
                    width: 72,
                    height: 72,
                    child: NoStorePhoto(
                      path: '$photoBase/${p['id']}',
                      onTap: () => context.push(
                        '/review-photo?path=${Uri.encodeQueryComponent('$photoBase/${p['id']}')}',
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
        if (review['reply'] != null) ...[
          verticalGap(12),
          Panel(
            color: HelaColors.wash,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Shop response',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                ),
                verticalGap(4),
                Text(string(review['reply'])),
              ],
            ),
          ),
        ],
        if (report != null)
          TextButton(onPressed: report, child: const Text('Report review')),
      ],
    ),
  );
}

Future<void> reportReview(
  BuildContext context,
  WidgetRef ref,
  String path,
) async {
  final user = ref.read(sessionProvider).value;
  if (user == null || !user.verified) {
    context.push(user == null ? '/auth' : '/verify');
    return;
  }
  final controller = TextEditingController();
  final form = GlobalKey<FormState>();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (c) => SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          MediaQuery.viewInsetsOf(c).bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Report review', style: Theme.of(c).textTheme.titleLarge),
                verticalGap(),
                const Text(
                  'Tell HelaCart what is wrong. Your report is private.',
                ),
                verticalGap(),
                TextFormField(
                  controller: controller,
                  maxLines: 4,
                  maxLength: 500,
                  decoration: const InputDecoration(labelText: 'Reason'),
                  validator: (v) => requiredText(v, min: 10, max: 500),
                ),
                verticalGap(),
                ActionButton(
                  label: 'Submit report',
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    await ref.read(repositoryProvider).write(path, 'POST', {
                      'reason': controller.text.trim(),
                    });
                    if (c.mounted) {
                      Navigator.pop(c);
                      toast(context, 'Report sent to HelaCart.');
                    }
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  controller.dispose();
}

class StarPicker extends StatelessWidget {
  const StarPicker({super.key, required this.value, required this.changed});
  final int value;
  final ValueChanged<int> changed;
  @override
  Widget build(BuildContext context) => Wrap(
    children: [
      for (var i = 1; i <= 5; i++)
        IconButton(
          tooltip: '$i out of 5 stars',
          onPressed: () => changed(i),
          icon: Icon(
            i <= value ? Icons.star : Icons.star_border,
            color: HelaColors.teal,
            size: 30,
          ),
        ),
    ],
  );
}

class ProductReviewEditor extends ConsumerStatefulWidget {
  const ProductReviewEditor({
    super.key,
    required this.productId,
    required this.access,
  });
  final String productId;
  final Json access;
  @override
  ConsumerState<ProductReviewEditor> createState() =>
      _ProductReviewEditorState();
}

class _ProductReviewEditorState extends ConsumerState<ProductReviewEditor> {
  final form = GlobalKey<FormState>();
  late final existing = object(widget.access['review']);
  late final comment = TextEditingController(text: string(existing['comment']));
  late int stars = integer(existing['rating'], 5);
  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hidden = boolean(existing['isHidden']);
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.access['eligible'] != true || hidden)
            Notice(
              string(
                widget.access['reason'],
                'A delivered purchase of this product is required.',
              ),
            )
          else
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    existing.isEmpty
                        ? 'Write a product review'
                        : 'Your product review',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  StarPicker(
                    value: stars,
                    changed: (v) => setState(() => stars = v),
                  ),
                  TextFormField(
                    controller: comment,
                    maxLength: 1500,
                    minLines: 3,
                    maxLines: 7,
                    decoration: const InputDecoration(
                      labelText: 'Your experience',
                    ),
                    validator: (v) => requiredText(v, min: 10, max: 1500),
                  ),
                  verticalGap(),
                  ActionButton(
                    label: existing.isEmpty ? 'Publish review' : 'Save changes',
                    action: () async {
                      if (!form.currentState!.validate()) return;
                      await ref.read(repositoryProvider).write(
                        '/products/${widget.productId}/customer-reviews/mine',
                        'PUT',
                        {
                          'version': integer(existing['version']),
                          'rating': stars,
                          'comment': comment.text.trim(),
                        },
                      );
                      ref.invalidate(resourceProvider);
                      if (context.mounted) toast(context, 'Review saved.');
                    },
                  ),
                ],
              ),
            ),
          if (existing.isNotEmpty && existing['deletedAt'] == null) ...[
            verticalGap(8),
            ActionButton(
              label: 'Delete my review',
              outlined: true,
              action: () async {
                if (!await confirm(
                  context,
                  title: 'Delete your review?',
                  message: 'It will no longer appear publicly. Moderation history is retained.',
                  action: 'Delete review',
                )) {
                  return;
                }
                await ref.read(repositoryProvider).write(
                  '/products/${widget.productId}/customer-reviews/mine',
                  'DELETE',
                  {'version': integer(existing['version'])},
                );
                ref.invalidate(resourceProvider);
              },
            ),
          ],
        ],
      ),
    );
  }
}

class ShopReviewEditor extends ConsumerStatefulWidget {
  const ShopReviewEditor({super.key, required this.slug, required this.access});
  final String slug;
  final Json access;
  @override
  ConsumerState<ShopReviewEditor> createState() => _ShopReviewEditorState();
}

class _ShopReviewEditorState extends ConsumerState<ShopReviewEditor> {
  final form = GlobalKey<FormState>();
  final comment = TextEditingController();
  String? order;
  int stars = 5;
  List<Json> kept = [];
  List<XFile> photos = [];
  List<Json> get orders => objects(widget.access['orders']);
  Json get existing =>
      object(orders.where((r) => r['id'] == order).firstOrNull?['shopReview']);
  @override
  void initState() {
    super.initState();
    if (orders.isNotEmpty) choose(string(orders.first['id']));
  }

  void choose(String value) {
    order = value;
    stars = integer(existing['rating'], 5);
    comment.text = existing['deletedAt'] == null
        ? string(existing['comment'])
        : '';
    kept = existing['deletedAt'] == null ? objects(existing['photos']) : [];
    photos = [];
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return const Notice(
        'A delivered purchase from this shop is required to write a shop review.',
      );
    }
    final hidden = boolean(existing['isHidden']);
    return Panel(
      child: Form(
        key: form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Your shop review',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            verticalGap(),
            DropdownButtonFormField<String>(
              initialValue: order,
              decoration: const InputDecoration(
                labelText: 'Delivered shop order',
              ),
              isExpanded: true,
              items: orders
                  .map(
                    (r) => DropdownMenuItem(
                      value: string(r['id']),
                      child: Text(
                        '${string(r['id']).substring(0, 8)} · ${dateText(r['createdAt'])}',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => choose(v!)),
            ),
            if (hidden)
              const Notice(
                'This review is hidden by moderation and cannot be republished.',
              )
            else ...[
              StarPicker(
                value: stars,
                changed: (v) => setState(() => stars = v),
              ),
              TextFormField(
                controller: comment,
                maxLength: 1500,
                minLines: 3,
                maxLines: 7,
                decoration: const InputDecoration(
                  labelText: 'Your shop experience',
                ),
                validator: (v) => requiredText(v, min: 10, max: 1500),
              ),
              verticalGap(),
              Wrap(
                spacing: 8,
                children: [
                  for (final p in kept)
                    InputChip(
                      label: const Text('Saved photo'),
                      onDeleted: () => setState(() => kept.remove(p)),
                    ),
                  for (final p in photos)
                    InputChip(
                      label: Text(p.name, maxLines: 1),
                      onDeleted: () => setState(() => photos.remove(p)),
                    ),
                ],
              ),
              ActionButton(
                label: 'Add photos (${kept.length + photos.length}/3)',
                outlined: true,
                enabled: kept.length + photos.length < 3,
                action: () async {
                  final picked = await ImagePicker().pickMultiImage(
                    requestFullMetadata: false,
                  );
                  if (picked.length + kept.length + photos.length > 3) {
                    throw const AppFailure('Choose up to 3 photos in total.');
                  }
                  for (final p in picked) {
                    final bytes = await p.readAsBytes();
                    if (bytes.length > 5 * 1024 * 1024) {
                      throw const AppFailure('Photos must be 5 MB or smaller.');
                    }
                    await photoPart(p.name, bytes);
                  }
                  if (mounted) setState(() => photos.addAll(picked));
                },
              ),
              const Text(
                'Optional · JPEG, PNG or WebP · up to 5 MB each',
                style: TextStyle(fontSize: 11, color: HelaColors.muted),
              ),
              verticalGap(),
              ActionButton(
                label: 'Publish shop review',
                action: () async {
                  if (!form.currentState!.validate()) return;
                  final data = FormData.fromMap({
                    'rating': '$stars',
                    'comment': comment.text.trim(),
                    'keepPhotoIds': jsonEncode(
                      kept.map((p) => p['id']).toList(),
                    ),
                  });
                  for (final p in photos) {
                    data.files.add(
                      MapEntry(
                        'photos',
                        await photoPart(p.name, await p.readAsBytes()),
                      ),
                    );
                  }
                  await ref
                      .read(repositoryProvider)
                      .write(
                        '/shops/${Uri.encodeComponent(widget.slug)}/reviews/$order',
                        'PUT',
                        data,
                      );
                  ref.invalidate(resourceProvider);
                  if (context.mounted) toast(context, 'Shop review saved.');
                },
              ),
            ],
            if (existing['id'] != null) ...[
              verticalGap(8),
              ActionButton(
                label: 'Delete my shop review',
                outlined: true,
                action: () async {
                  if (!await confirm(
                    context,
                    title: 'Delete shop review?',
                    message: 'Your review and its public photos will no longer be visible.',
                    action: 'Delete review',
                  )) {
                    return;
                  }
                  await ref
                      .read(repositoryProvider)
                      .write(
                        '/shops/${Uri.encodeComponent(widget.slug)}/reviews/${existing['id']}',
                        'DELETE',
                      );
                  ref.invalidate(resourceProvider);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

final photoBytesProvider = FutureProvider.autoDispose.family<List<int>, String>(
  (ref, path) async {
    ref.watch(sessionProvider);
    final result = await ref
        .watch(apiProvider)
        .dio
        .get<List<int>>(
          path,
          options: Options(
            responseType: ResponseType.bytes,
            headers: {'Cache-Control': 'no-store'},
          ),
        );
    return result.data ?? [];
  },
  retry: (count, error) => null,
);

class NoStorePhoto extends ConsumerWidget {
  const NoStorePhoto({super.key, required this.path, this.onTap});
  final String path;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(photoBytesProvider(path))
      .when(
        data: (data) => InkWell(
          onTap: onTap,
          child: Image.memory(
            Uint8List.fromList(data),
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined),
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) =>
            const Center(child: Icon(Icons.image_not_supported_outlined)),
      );
}

class ReviewPhotoScreen extends StatelessWidget {
  const ReviewPhotoScreen({super.key, required this.path});
  final String path;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Review photo',
    child: InteractiveViewer(
      child: Center(child: NoStorePhoto(path: path)),
    ),
  );
}
